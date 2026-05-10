import { app, BrowserWindow, ipcMain } from 'electron'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AuthEvent, AuthService } from '../auth/authService'
import type { HelixClient } from '../twitch/helixClient'
import type { PlaybackService } from '../playback/playbackService'
import type { HlsUrlPayload } from '../playback/playbackService'
import type { PlaybackEvent } from '../playback/types'
import { getProgressMap } from '../store/historyRepo'

export const IPC = {
  appQuit: 'app:quit',
  authStatus: 'auth:get-status',
  authStart: 'auth:start-device-flow',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authConfigured: 'auth:is-configured',
  /** main → renderer */
  authEvent: 'auth:event',

  twitchGetFollowed: 'twitch:get-followed',
  twitchGetOwnUser: 'twitch:get-own-user',
  twitchGetVideos: 'twitch:get-videos',
  twitchGetTopGames: 'twitch:get-top-games',
  twitchGetTopStreams: 'twitch:get-top-streams',
  twitchGetVodChapters: 'twitch:get-vod-chapters',
  historyGetProgress: 'history:get-progress',

  playbackStartLive: 'playback:start-live',
  playbackStartVod: 'playback:start-vod',
  playbackStop: 'playback:stop',
  playbackPause: 'playback:pause',
  playbackReportPosition: 'playback:report-position',
  /** main → renderer */
  playbackEvent: 'playback:event',
  /** main → renderer: HLS-URL + Metadaten für den Renderer-seitigen Video-Player */
  playbackHlsUrl: 'playback:hls-url'
} as const

export function registerIpcHandlers(
  auth: AuthService,
  helix: HelixClient,
  playback: PlaybackService
): void {
  ipcMain.handle(IPC.appQuit, () => {
    app.quit()
  })

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
  ipcMain.handle(IPC.twitchGetOwnUser, () => helix.getOwnUserInfo())
  ipcMain.handle(
    IPC.twitchGetTopGames,
    (_e, cursor?: string) => helix.getTopGames(40, cursor)
  )
  ipcMain.handle(
    IPC.twitchGetTopStreams,
    (_e, options?: { gameId?: string; language?: string; cursor?: string; limit?: number }) =>
      helix.getTopStreams({
        gameId: options?.gameId,
        language: options?.language,
        cursor: options?.cursor,
        limit: options?.limit ?? (options?.gameId ? 40 : 100)
      })
  )
  ipcMain.handle(
    IPC.twitchGetVideos,
    (_e, broadcasterId: string) => helix.getVideos(broadcasterId)
  )
  ipcMain.handle(
    IPC.twitchGetVodChapters,
    (_e, videoId: string) => helix.getVodChapters(videoId)
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
    (_e, vodId: string, channelLogin: string, title: string, durationSeconds: number, startSeconds?: number) =>
      playback.startVod(vodId, channelLogin, title, durationSeconds, startSeconds)
  )
  ipcMain.handle(IPC.playbackStop, () => playback.stop())
  ipcMain.handle(IPC.playbackPause, () => {
    // Fokus auf Electron-Fenster zurückholen (Windows: Win Gamepad API braucht Fokus)
    for (const win of BrowserWindow.getAllWindows()) win.focus()
  })
  ipcMain.handle(
    IPC.playbackReportPosition,
    (_e, vodId: string, positionSeconds: number, durationSeconds: number) => {
      playback.updateVodPosition(vodId, positionSeconds, durationSeconds)
    }
  )

  playback.on('playback-event', (event: PlaybackEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.playbackEvent, event)
    }
  })

  playback.on('playback-hls-url', (payload: HlsUrlPayload) => {
    try {
      const logPath = join(app.getPath('userData'), 'debug-playback.log')
      appendFileSync(logPath, `[${new Date().toISOString()}] HLS URL (isLive=${payload.isLive}): ${payload.url}\n`)
    } catch { /* ignore log errors */ }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.playbackHlsUrl, payload)
    }
  })
}
