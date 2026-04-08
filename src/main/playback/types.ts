export type Quality =
  | 'best'
  | '1080p60'
  | '720p60'
  | '480p'
  | '360p'
  | '160p'
  | 'audio_only'
  | 'worst'

export interface PlaybackEvent {
  kind: 'started' | 'stopped' | 'error'
  channelLogin?: string
  message?: string
}
