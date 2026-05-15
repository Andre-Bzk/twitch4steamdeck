// Data types: src/shared/types.ts (canonical source, compiler-enforced).
// T4sdApi: keep manually in sync with src/preload/index.ts.
// Direct import is not possible: tsconfig.web.json and tsconfig.node.json are separate
// composite projects — preload/index.ts is not reachable from the renderer build.

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
} from '../../../shared/types'

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
} from '../../../shared/types'

export interface T4sdApi {
  appVersion: string
  app: {
    quit: () => Promise<void>
    getCacheSize: () => Promise<number>
    clearCache: () => Promise<void>
    setHlsCacheEnabled: (enabled: boolean) => Promise<void>
    setFileLoggingEnabled: (enabled: boolean) => Promise<void>
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
