// Spiegel der Preload-API. Manuell synchron halten zu src/preload/index.ts.

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

export interface GameInfo {
  id: string
  name: string
  boxArtUrl: string
  viewerCount?: number
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

export interface VodChapter {
  positionSeconds: number
  durationSeconds: number
  gameName: string
  gameId: string | null
}

export interface T4sdApi {
  appVersion: string
  auth: {
    isConfigured: () => Promise<boolean>
    getStatus: () => Promise<AuthStatus>
    startDeviceFlow: () => Promise<DeviceFlowStartInfo>
    cancel: () => Promise<void>
    logout: () => Promise<void>
    onEvent: (cb: (event: AuthEvent) => void) => () => void
  }
  twitch: {
    getFollowed: () => Promise<FollowedChannelInfo[]>
    getVideos: (broadcasterId: string) => Promise<VodInfo[]>
    getTopGames: (cursor?: string) => Promise<{ games: GameInfo[]; cursor?: string }>
    getTopStreams: (gameId?: string) => Promise<FollowedChannelInfo[]>
    getVodChapters: (vodId: string) => Promise<VodChapter[]>
  }
  history: {
    getProgress: (vodIds: string[]) => Promise<Record<string, VodProgress>>
  }
  playback: {
    startLive: (channelLogin: string, quality?: string) => Promise<void>
    startVod: (vodId: string, channelLogin: string, title: string, durationSeconds: number, startSeconds?: number) => Promise<void>
    stop: () => Promise<void>
    seek: (seconds: number) => Promise<void>
    togglePause: () => Promise<void>
    pause: () => Promise<void>
    resume: () => Promise<void>
    seekTo: (seconds: number) => Promise<void>
    onEvent: (cb: (event: PlaybackEvent) => void) => () => void
  }
  gamepad: {
    onInput: (cb: (key: string) => void) => () => void
  }
}

declare global {
  interface Window {
    t4sd: T4sdApi
  }
}
