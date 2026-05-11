import { app, BrowserWindow, shell, screen, session } from 'electron'
import { join } from 'node:path'
import { AuthService } from './auth/authService'
import { HelixClient } from './twitch/helixClient'
import { PlaybackService } from './playback/playbackService'
import { registerIpcHandlers } from './ipc/handlers'
import { startGamepadReader } from './input/gamepadReader'
import { getHlsCacheEnabled } from './prefs/hlsCachePref'

const isDev = !app.isPackaged

// Erlaubt video.play() ohne vorangehende User-Geste (nötig, weil play() in hls.js-Callbacks
// aufgerufen wird, die asynchron weit nach dem ursprünglichen Click-Event stattfinden).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

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

function isHlsStreamContent(url: string): boolean {
  const pathEnd = url.indexOf('?')
  const path = pathEnd === -1 ? url : url.slice(0, pathEnd)
  return /\.(m3u8|ts|m4s|aac)$/i.test(path)
}

/**
 * CORS-Bypass für Twitch CDN und HLS-Streams.
 * hls.js im Renderer sendet Requests von localhost/file:// — Twitch CDN erwartet
 * Origin: https://www.twitch.tv. Wir setzen Origin + Referer auf ausgehenden Requests
 * und ergänzen CORS-Response-Header, damit Chromium die Antworten akzeptiert.
 * Zusätzlich: cache-control: no-store für HLS-Inhalte wenn hlsCacheEnabled=false.
 */
function setupTwitchCors(): void {
  const isTwitchCdn = (url: string): boolean =>
    url.includes('twitchsvc.net') ||
    url.includes('cloudfront.net') ||
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
    const isCdn = isTwitchCdn(details.url)
    const applyNoStore = isHlsStreamContent(details.url) && !getHlsCacheEnabled()

    if (!isCdn && !applyNoStore) { callback({}); return }

    const headers: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(details.responseHeaders ?? {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v : [v]
    }
    if (isCdn) {
      headers['access-control-allow-origin'] = ['*']
      headers['access-control-allow-headers'] = ['*']
      headers['access-control-allow-methods'] = ['GET, HEAD, OPTIONS']
    }
    if (applyNoStore) {
      headers['cache-control'] = ['no-store']
    }
    callback({ responseHeaders: headers })
  })
}

app.whenReady().then(async () => {
  setupTwitchCors()
  const clientId = import.meta.env.MAIN_VITE_TWITCH_CLIENT_ID ?? ''
  const auth = new AuthService(clientId)
  await auth.init()
  const helix = new HelixClient(clientId, async () => {
    const token = await auth.getValidAccessToken()
    if (!token) throw new Error('Kein gueltiges Twitch-Access-Token vorhanden')
    return token
  })
  const playback = new PlaybackService()

  registerIpcHandlers(auth, helix, playback)

  const stopGamepad = startGamepadReader(() => BrowserWindow.getAllWindows()[0] ?? null)

  app.on('before-quit', () => {
    stopGamepad()
    playback.stop()
  })

  if (!clientId) {
    console.warn(
      '[twitch4steamdeck] MAIN_VITE_TWITCH_CLIENT_ID nicht gesetzt — Login wird im UI als nicht konfiguriert angezeigt.'
    )
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
