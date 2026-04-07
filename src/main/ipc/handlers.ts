import { BrowserWindow, ipcMain } from 'electron'
import type { AuthEvent, AuthService } from '../auth/authService'

export const IPC = {
  authStatus: 'auth:get-status',
  authStart: 'auth:start-device-flow',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authConfigured: 'auth:is-configured',
  /** main → renderer */
  authEvent: 'auth:event'
} as const

export function registerIpcHandlers(auth: AuthService): void {
  ipcMain.handle(IPC.authStatus, () => auth.getStatus())
  ipcMain.handle(IPC.authConfigured, () => auth.isConfigured())
  ipcMain.handle(IPC.authStart, () => auth.startDeviceFlow())
  ipcMain.handle(IPC.authCancel, () => {
    auth.cancelFlow()
  })
  ipcMain.handle(IPC.authLogout, () => auth.logout())

  auth.on('auth-event', (event: AuthEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.authEvent, event)
    }
  })
}
