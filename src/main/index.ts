import { app, BrowserWindow, shell, screen } from 'electron'
import { join } from 'node:path'
import { AuthService } from './auth/authService'
import { HelixClient } from './twitch/helixClient'
import { PlaybackService } from './playback/playbackService'
import { registerIpcHandlers } from './ipc/handlers'
import { startGamepadReader } from './input/gamepadReader'

const isDev = !app.isPackaged

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

app.whenReady().then(async () => {
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
    playback.stopAll()
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
