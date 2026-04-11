export interface HelixUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
}

export interface HelixFollowedChannel {
  broadcaster_id: string
  broadcaster_login: string
  broadcaster_name: string
  followed_at: string
}

export interface HelixStream {
  user_id: string
  user_login: string
  user_name: string
  game_id: string
  game_name: string
  title: string
  viewer_count: number
  thumbnail_url: string
  started_at: string
  language: string
}

export interface HelixPaginatedResponse<T> {
  data: T[]
  pagination?: { cursor?: string }
}

export interface HelixVideo {
  id: string
  user_id: string
  title: string
  created_at: string
  thumbnail_url: string
  duration: string   // e.g. "3h40m1s"
  view_count: number
  type: 'archive' | 'highlight' | 'upload'
}

export interface HelixGame {
  id: string
  name: string
  box_art_url: string
}

/** Simplified game info für den Renderer. */
export interface GameInfo {
  id: string
  name: string
  /** Boxart-URL bereits auf 285×380 aufgelöst */
  boxArtUrl: string
  /** Summe der Zuschauer aus den Top-100-Streams der Kategorie */
  viewerCount?: number
}

/** Simplified VOD info für den Renderer. */
export interface VodInfo {
  id: string
  title: string
  createdAt: string
  durationSeconds: number
  viewCount: number
  /** Thumbnail URL bereits auf 440×248 aufgelöst */
  thumbnailUrl: string
}

export interface VodChapter {
  positionSeconds: number
  durationSeconds: number
  gameName: string
  gameId: string | null
}

/** Merged type that the renderer receives. */
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
  /** 440×248 thumbnail URL (only set when live) */
  thumbnailUrl?: string
  startedAt?: string
  language?: string
}

export interface TopStreamsResult {
  streams: FollowedChannelInfo[]
  cursor?: string
}
