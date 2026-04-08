import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const IPC = {
  authStatus: 'auth:get-status',
  authStart: 'auth:start-device-flow',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authConfigured: 'auth:is-configured',
  authEvent: 'auth:event',

  twitchGetFollowed: 'twitch:get-followed',
  twitchGetVideos: 'twitch:get-videos',
  historyGetProgress: 'history:get-progress',

  playbackStartLive: 'playback:start-live',
  playbackStartVod: 'playback:start-vod',
  playbackStop: 'playback:stop',
  playbackEvent: 'playback:event'
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
  gameName?: string
  viewerCount?: number
  thumbnailUrl?: string
  startedAt?: string
}

export interface PlaybackEvent {
  kind: 'started' | 'stopped' | 'error'
  channelLogin?: string
  message?: string
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

const api = {
  appVersion: process.env.npm_package_version ?? '0.0.0',
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
    getVideos: (broadcasterId: string): Promise<VodInfo[]> =>
      ipcRenderer.invoke(IPC.twitchGetVideos, broadcasterId)
  },
  history: {
    getProgress: (vodIds: string[]): Promise<Record<string, VodProgress>> =>
      ipcRenderer.invoke(IPC.historyGetProgress, vodIds)
  },
  playback: {
    startLive: (channelLogin: string, quality?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.playbackStartLive, channelLogin, quality),
    startVod: (vodId: string, channelLogin: string, title: string, durationSeconds: number): Promise<void> =>
      ipcRenderer.invoke(IPC.playbackStartVod, vodId, channelLogin, title, durationSeconds),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.playbackStop),
    onEvent: (cb: (event: PlaybackEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, event: PlaybackEvent): void => cb(event)
      ipcRenderer.on(IPC.playbackEvent, listener)
      return () => ipcRenderer.removeListener(IPC.playbackEvent, listener)
    }
  }
}

contextBridge.exposeInMainWorld('t4sd', api)

export type T4sdApi = typeof api
