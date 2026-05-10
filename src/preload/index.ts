import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const IPC = {
  appQuit: 'app:quit',
  authStatus: 'auth:get-status',
  authStart: 'auth:start-device-flow',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authConfigured: 'auth:is-configured',
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
  playbackEvent: 'playback:event',
  playbackHlsUrl: 'playback:hls-url',

  gamepadInput: 'gamepad-input'
} as const

export type AuthStatus = 'logged-out' | 'logged-in'

export interface DeviceFlowStartInfo {
  userCode: string
  verificationUri: string
  expiresInSec: number
}

export type AuthEvent =
  | { kind: 'authorized' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

export interface FollowedChannelInfo {
  broadcasterId: string
  broadcasterLogin: string
  broadcasterName: string
  profileImageUrl: string
  isLive: boolean
  streamTitle?: string
  gameId?: string
  gameName?: string
  viewerCount?: number
  thumbnailUrl?: string
  startedAt?: string
  language?: string
}

export interface OwnUserInfo {
  id: string
  login: string
  displayName: string
  profileImageUrl: string
}

export interface PlaybackEvent {
  kind: 'started' | 'stopped' | 'error'
  channelLogin?: string
  message?: string
  durationSeconds?: number
  isLive?: boolean
}

export interface HlsUrlPayload {
  url: string
  isLive: boolean
  startPosition: number
  durationSeconds: number
  vodId?: string
}

export interface GameInfo {
  id: string
  name: string
  boxArtUrl: string
  viewerCount?: number
}

export interface VodInfo {
  id: string
  title: string
  createdAt: string
  durationSeconds: number
  viewCount: number
  thumbnailUrl: string
}

export interface VodProgress {
  resumePositionSeconds: number
  watchedAt: number
  completed: boolean
}

export interface VodChapter {
  positionSeconds: number
  durationSeconds: number
  gameName: string
  gameId: string | null
}

export interface TopStreamsResult {
  streams: FollowedChannelInfo[]
  cursor?: string
}

const api = {
  appVersion: process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.0-dev',
  app: {
    quit: (): Promise<void> => ipcRenderer.invoke(IPC.appQuit)
  },
  auth: {
    isConfigured: (): Promise<boolean> => ipcRenderer.invoke(IPC.authConfigured),
    getStatus: (): Promise<AuthStatus> => ipcRenderer.invoke(IPC.authStatus),
    startDeviceFlow: (): Promise<DeviceFlowStartInfo> => ipcRenderer.invoke(IPC.authStart),
    cancel: (): Promise<void> => ipcRenderer.invoke(IPC.authCancel),
    logout: (): Promise<void> => ipcRenderer.invoke(IPC.authLogout),
    onEvent: (cb: (event: AuthEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, event: AuthEvent): void => cb(event)
      ipcRenderer.on(IPC.authEvent, listener)
      return () => ipcRenderer.removeListener(IPC.authEvent, listener)
    }
  },
  twitch: {
    getFollowed: (): Promise<FollowedChannelInfo[]> =>
      ipcRenderer.invoke(IPC.twitchGetFollowed),
    getOwnUser: (): Promise<OwnUserInfo> =>
      ipcRenderer.invoke(IPC.twitchGetOwnUser),
    getVideos: (broadcasterId: string): Promise<VodInfo[]> =>
      ipcRenderer.invoke(IPC.twitchGetVideos, broadcasterId),
    getTopGames: (cursor?: string): Promise<{ games: GameInfo[]; cursor?: string }> =>
      ipcRenderer.invoke(IPC.twitchGetTopGames, cursor),
    getTopStreams: (options?: { gameId?: string; language?: string; cursor?: string; limit?: number }): Promise<TopStreamsResult> =>
      ipcRenderer.invoke(IPC.twitchGetTopStreams, options),
    getVodChapters: (vodId: string): Promise<VodChapter[]> =>
      ipcRenderer.invoke(IPC.twitchGetVodChapters, vodId)
  },
  history: {
    getProgress: (vodIds: string[]): Promise<Record<string, VodProgress>> =>
      ipcRenderer.invoke(IPC.historyGetProgress, vodIds)
  },
  playback: {
    startLive: (channelLogin: string, quality?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.playbackStartLive, channelLogin, quality),
    startVod: (vodId: string, channelLogin: string, title: string, durationSeconds: number, startSeconds?: number): Promise<void> =>
      ipcRenderer.invoke(IPC.playbackStartVod, vodId, channelLogin, title, durationSeconds, startSeconds),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.playbackStop),
    pause: (): Promise<void> => ipcRenderer.invoke(IPC.playbackPause),
    reportPosition: (vodId: string, positionSeconds: number, durationSeconds: number): Promise<void> =>
      ipcRenderer.invoke(IPC.playbackReportPosition, vodId, positionSeconds, durationSeconds),
    onEvent: (cb: (event: PlaybackEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, event: PlaybackEvent): void => cb(event)
      ipcRenderer.on(IPC.playbackEvent, listener)
      return () => ipcRenderer.removeListener(IPC.playbackEvent, listener)
    },
    onHlsUrl: (cb: (payload: HlsUrlPayload) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, payload: HlsUrlPayload): void => cb(payload)
      ipcRenderer.on(IPC.playbackHlsUrl, listener)
      return () => ipcRenderer.removeListener(IPC.playbackHlsUrl, listener)
    }
  },
  gamepad: {
    onInput: (cb: (key: string) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, key: string): void => cb(key)
      ipcRenderer.on(IPC.gamepadInput, listener)
      return () => ipcRenderer.removeListener(IPC.gamepadInput, listener)
    }
  }
}

contextBridge.exposeInMainWorld('t4sd', api)

export type T4sdApi = typeof api
