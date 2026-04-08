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
  }
  playback: {
    startLive: (channelLogin: string, quality?: string) => Promise<void>
    stop: () => Promise<void>
    onEvent: (cb: (event: PlaybackEvent) => void) => () => void
  }
}

declare global {
  interface Window {
    t4sd: T4sdApi
  }
}
