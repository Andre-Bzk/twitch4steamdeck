import { app, BrowserWindow, shell, screen, session } from 'electron'
import { join } from 'node:path'
import { AuthService } from './auth/authService'
import { HelixClient } from './twitch/helixClient'
import { PlaybackService } from './playback/playbackService'
import { registerIpcHandlers } from './ipc/handlers'
import { startGamepadReader } from './input/gamepadReader'

import log from 'electron-log/main'

log.initialize()
log.transports.file.level = 'error'
log.transports.console.level = 'debug'

const isDev = !app.isPackaged
const MAX_CACHE_BYTES = 512 * 1024 * 1024

// Allows video.play() without a prior user gesture — play() is called from hls.js callbacks
// that fire asynchronously long after the original click event.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Explicit cache size prevents Chromium's dynamic sizing, which causes "Invalid cache (current)
// size" errors when available disk space fluctuates.
app.commandLine.appendSwitch('disk-cache-size', String(MAX_CACHE_BYTES))

async function clearDefaultSessionCache(reason: 'startup' | 'quit'): Promise<void> {
  try {
    await session.defaultSession.clearCache()
    log.info(`[twitch4steamdeck] Cleared Electron cache on ${reason}.`)
  } catch (err) {
    log.warn(`[twitch4steamdeck] Failed to clear Electron cache on ${reason}.`, err)
  }
}

function createWindow(): BrowserWindow {
  const isLinux = process.platform === 'linux'
  const { width, height } = isLinux
    ? screen.getPrimaryDisplay().workAreaSize
    : { width: 1280, height: 800 }

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    if (isLinux) win.maximize()
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * CORS bypass for Twitch CDN and HLS streams.
 * hls.js in the renderer sends requests from localhost/file:// — Twitch CDN expects
 * Origin: https://www.twitch.tv. We set Origin + Referer on outgoing requests
 * and inject CORS response headers so Chromium accepts the responses.
 *
 * HLS cache suppression: xhrSetup in hls.js sets Cache-Control: no-store on every
 * XHR. This triggers a CORS preflight (Cache-Control is not a safelisted header).
 * For the preflight to pass, onHeadersReceived must also cover ttvnw.net domains
 * (segment CDN: *.j.cloudfront.hls.ttvnw.net — does not contain "cloudfront.net").
 */
function setupTwitchCors(): void {
  const isTwitchCdn = (url: string): boolean =>
    url.includes('twitchsvc.net') ||
    url.includes('cloudfront.net') ||
    url.includes('ttvnw.net') ||
    url.includes('twitch.tv') ||
    url.includes('twitch.amazon.com')

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (isTwitchCdn(details.url)) {
      details.requestHeaders['Origin'] = 'https://www.twitch.tv'
      details.requestHeaders['Referer'] = 'https://www.twitch.tv/'
    }
    callback({ requestHeaders: details.requestHeaders })
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isTwitchCdn(details.url)) { callback({}); return }

    const headers: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(details.responseHeaders ?? {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v : [v]
    }
    headers['access-control-allow-origin'] = ['*']
    headers['access-control-allow-headers'] = ['*']
    headers['access-control-allow-methods'] = ['GET, HEAD, OPTIONS']
    callback({ responseHeaders: headers })
  })
}

app.whenReady().then(async () => {
  await clearDefaultSessionCache('startup')
  setupTwitchCors()
  const clientId = import.meta.env.MAIN_VITE_TWITCH_CLIENT_ID ?? ''
  const auth = new AuthService(clientId)
  await auth.init()
  const helix = new HelixClient(clientId, async () => {
    const token = await auth.getValidAccessToken()
    if (!token) throw new Error('No valid Twitch access token available')
    return token
  })
  const playback = new PlaybackService()

  registerIpcHandlers(auth, helix, playback)

  const stopGamepad = startGamepadReader(() => BrowserWindow.getAllWindows()[0] ?? null)
  let servicesStopped = false
  let quitAfterCacheClear = false

  app.on('before-quit', (event) => {
    if (!servicesStopped) {
      stopGamepad()
      playback.stop()
      servicesStopped = true
    }
    if (quitAfterCacheClear) return

    event.preventDefault()
    void clearDefaultSessionCache('quit').finally(() => {
      quitAfterCacheClear = true
      app.quit()
    })
  })

  if (!clientId) {
    log.warn('[twitch4steamdeck] MAIN_VITE_TWITCH_CLIENT_ID is not set — the UI will show login as not configured.')
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
