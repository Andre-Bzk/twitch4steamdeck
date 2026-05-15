import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../main/ipc/channels'
import type {
  AuthStatus,
  DeviceFlowStartInfo,
  AuthEvent,
  FollowedChannelInfo,
  OwnUserInfo,
  PlaybackEvent,
  HlsUrlPayload,
  GameInfo,
  VodInfo,
  VodProgress,
  VodChapter,
  TopStreamsResult
} from '../shared/types'

export type {
  AuthStatus,
  DeviceFlowStartInfo,
  AuthEvent,
  FollowedChannelInfo,
  OwnUserInfo,
  PlaybackEvent,
  HlsUrlPayload,
  GameInfo,
  VodInfo,
  VodProgress,
  VodChapter,
  TopStreamsResult
}

const api = {
  appVersion: process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.0-dev',
  app: {
    quit: (): Promise<void> => ipcRenderer.invoke(IPC.appQuit),
    getCacheSize: (): Promise<number> => ipcRenderer.invoke(IPC.appGetCacheSize),
    clearCache: (): Promise<void> => ipcRenderer.invoke(IPC.appClearCache),
    setHlsCacheEnabled: (enabled: boolean): Promise<void> => ipcRenderer.invoke(IPC.appSetHlsCacheEnabled, enabled)
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
    startVod: (vodId: string, channelLogin: string, title: string, durationSeconds: number, startSeconds?: number, quality?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.playbackStartVod, vodId, channelLogin, title, durationSeconds, startSeconds, quality),
    getQualities: (twitchUrl: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.playbackGetQualities, twitchUrl),
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
