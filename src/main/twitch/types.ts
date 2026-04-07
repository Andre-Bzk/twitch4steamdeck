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
  game_name: string
  title: string
  viewer_count: number
  thumbnail_url: string
  started_at: string
}

export interface HelixPaginatedResponse<T> {
  data: T[]
  pagination?: { cursor?: string }
}

/** Merged type that the renderer receives. */
export interface FollowedChannelInfo {
  broadcasterId: string
  broadcasterLogin: string
  broadcasterName: string
  profileImageUrl: string
  isLive: boolean
  streamTitle?: string
  gameName?: string
  viewerCount?: number
  /** 440×248 thumbnail URL (only set when live) */
  thumbnailUrl?: string
  startedAt?: string
}
