import { app, BrowserWindow, ipcMain, session } from 'electron'
import { setHlsCacheEnabled } from '../prefs/hlsCachePref'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AuthEvent, AuthService } from '../auth/authService'
import type { HelixClient } from '../twitch/helixClient'
import type { PlaybackService } from '../playback/playbackService'
import type { HlsUrlPayload } from '../playback/playbackService'
import type { PlaybackEvent } from '../playback/types'
import { getProgressMap } from '../store/historyRepo'
import { IPC } from './channels'
import log from 'electron-log/main'

export { IPC }

function safeHandle<A extends unknown[], R>(
  channel: string,
  fn: (...args: A) => R | Promise<R>,
): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return await fn(...(args as A)) }
    catch (err) { log.error(`[ipc:${channel}]`, err); throw err }
  })
}

export function registerIpcHandlers(
  auth: AuthService,
  helix: HelixClient,
  playback: PlaybackService
): void {
  safeHandle(IPC.appQuit, () => {
    app.quit()
  })

  safeHandle(IPC.appGetCacheSize, () => session.defaultSession.getCacheSize())
  safeHandle(IPC.appClearCache, () => session.defaultSession.clearCache())
  safeHandle(IPC.appSetHlsCacheEnabled, (enabled: boolean) => {
    setHlsCacheEnabled(Boolean(enabled))
  })
  safeHandle(IPC.appSetFileLoggingEnabled, (enabled: boolean) => {
    log.transports.file.level = Boolean(enabled) ? 'info' : 'error'
  })

  safeHandle(IPC.authStatus, () => auth.getStatus())
  safeHandle(IPC.authConfigured, () => auth.isConfigured())
  safeHandle(IPC.authStart, () => auth.startDeviceFlow())
  safeHandle(IPC.authCancel, () => {
    auth.cancelFlow()
  })
  safeHandle(IPC.authLogout, () => auth.logout())

  auth.on('auth-event', (event: AuthEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.authEvent, event)
    }
  })

  safeHandle(IPC.twitchGetFollowed, () => helix.getFollowedWithLiveStatus())
  safeHandle(IPC.twitchGetOwnUser, () => helix.getOwnUserInfo())
  safeHandle(
    IPC.twitchGetTopGames,
    (cursor?: string) => helix.getTopGames(40, cursor)
  )
  safeHandle(
    IPC.twitchGetTopStreams,
    (options?: { gameId?: string; language?: string; cursor?: string; limit?: number }) =>
      helix.getTopStreams({
        gameId: options?.gameId,
        language: options?.language,
        cursor: options?.cursor,
        limit: options?.limit ?? (options?.gameId ? 40 : 100)
      })
  )
  safeHandle(
    IPC.twitchGetVideos,
    (broadcasterId: string) => helix.getVideos(broadcasterId)
  )
  safeHandle(
    IPC.twitchGetVodChapters,
    (videoId: string) => helix.getVodChapters(videoId)
  )
  safeHandle(
    IPC.historyGetProgress,
    (vodIds: string[]) => getProgressMap(vodIds)
  )

  safeHandle(
    IPC.playbackStartLive,
    (channelLogin: string, quality?: string) => playback.startLive(channelLogin, quality)
  )
  safeHandle(
    IPC.playbackStartVod,
    (vodId: string, channelLogin: string, title: string, durationSeconds: number, startSeconds?: number, quality?: string) =>
      playback.startVod(vodId, channelLogin, title, durationSeconds, startSeconds, quality)
  )
  safeHandle(
    IPC.playbackGetQualities,
    (twitchUrl: string) => playback.getAvailableQualities(twitchUrl)
  )
  safeHandle(IPC.playbackStop, () => playback.stop())
  safeHandle(IPC.playbackPause, () => {
    // Bring Electron window back into focus (Windows: Gamepad API requires window focus)
    for (const win of BrowserWindow.getAllWindows()) win.focus()
  })
  safeHandle(
    IPC.playbackReportPosition,
    (vodId: string, positionSeconds: number, durationSeconds: number) => {
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
