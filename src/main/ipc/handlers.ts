import { BrowserWindow, ipcMain } from 'electron'
import type { AuthEvent, AuthService } from '../auth/authService'
import type { HelixClient } from '../twitch/helixClient'
import type { PlaybackService } from '../playback/playbackService'
import type { PlaybackEvent } from '../playback/types'
import { getProgressMap } from '../store/historyRepo'

export const IPC = {
  authStatus: 'auth:get-status',
  authStart: 'auth:start-device-flow',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authConfigured: 'auth:is-configured',
  /** main → renderer */
  authEvent: 'auth:event',

  twitchGetFollowed: 'twitch:get-followed',
  twitchGetVideos: 'twitch:get-videos',
  historyGetProgress: 'history:get-progress',

  playbackStartLive: 'playback:start-live',
  playbackStartVod: 'playback:start-vod',
  playbackStop: 'playback:stop',
  /** main → renderer */
  playbackEvent: 'playback:event'
} as const

export function registerIpcHandlers(
  auth: AuthService,
  helix: HelixClient,
  playback: PlaybackService
): void {
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

  ipcMain.handle(IPC.twitchGetFollowed, () => helix.getFollowedWithLiveStatus())
  ipcMain.handle(
    IPC.twitchGetVideos,
    (_e, broadcasterId: string) => helix.getVideos(broadcasterId)
  )
  ipcMain.handle(
    IPC.historyGetProgress,
    (_e, vodIds: string[]) => getProgressMap(vodIds)
  )

  ipcMain.handle(
    IPC.playbackStartLive,
    (_e, channelLogin: string, quality?: string) => playback.startLive(channelLogin, quality)
  )
  ipcMain.handle(
    IPC.playbackStartVod,
    (_e, vodId: string, channelLogin: string, title: string, durationSeconds: number) =>
      playback.startVod(vodId, channelLogin, title, durationSeconds)
  )
  ipcMain.handle(IPC.playbackStop, () => playback.stop())

  playback.on('playback-event', (event: PlaybackEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.playbackEvent, event)
    }
  })
}
