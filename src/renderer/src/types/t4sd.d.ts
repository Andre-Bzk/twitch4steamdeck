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

export interface OwnUserInfo {
  id: string
  login: string
  displayName: string
  profileImageUrl: string
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

export interface T4sdApi {
  appVersion: string
  app: {
    quit: () => Promise<void>
  }
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
    getOwnUser: () => Promise<OwnUserInfo>
    getVideos: (broadcasterId: string) => Promise<VodInfo[]>
    getTopGames: (cursor?: string) => Promise<{ games: GameInfo[]; cursor?: string }>
    getTopStreams: (options?: { gameId?: string; language?: string; cursor?: string; limit?: number }) => Promise<TopStreamsResult>
    getVodChapters: (vodId: string) => Promise<VodChapter[]>
  }
  history: {
    getProgress: (vodIds: string[]) => Promise<Record<string, VodProgress>>
  }
  playback: {
    startLive: (channelLogin: string, quality?: string) => Promise<void>
    startVod: (vodId: string, channelLogin: string, title: string, durationSeconds: number, startSeconds?: number, quality?: string) => Promise<void>
    getQualities: (twitchUrl: string) => Promise<string[]>
    stop: () => Promise<void>
    pause: () => Promise<void>
    reportPosition: (vodId: string, positionSeconds: number, durationSeconds: number) => Promise<void>
    onEvent: (cb: (event: PlaybackEvent) => void) => () => void
    onHlsUrl: (cb: (payload: HlsUrlPayload) => void) => () => void
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
