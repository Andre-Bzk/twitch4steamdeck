import type {
  FollowedChannelInfo,
  HelixFollowedChannel,
  HelixPaginatedResponse,
  HelixStream,
  HelixUser
} from './types'

const BASE = 'https://api.twitch.tv/helix'

export class HelixClient {
  private cachedUserId: string | null = null

  constructor(
    private readonly clientId: string,
    private readonly getToken: () => Promise<string>
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken()
    return {
      'Client-Id': this.clientId,
      Authorization: `Bearer ${token}`
    }
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    }
    const res = await fetch(url.toString(), { headers: await this.authHeaders() })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Helix ${path} → ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async getOwnUser(): Promise<HelixUser> {
    const data = await this.get<{ data: HelixUser[] }>('/users')
    const user = data.data[0]
    if (!user) throw new Error('Keine Nutzer-Daten von /users erhalten')
    this.cachedUserId = user.id
    return user
  }

  private async getOwnUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId
    const user = await this.getOwnUser()
    return user.id
  }

  private async getAllFollowed(userId: string): Promise<HelixFollowedChannel[]> {
    const all: HelixFollowedChannel[] = []
    let cursor: string | undefined
    do {
      const params: Record<string, string> = { user_id: userId, first: '100' }
      if (cursor) params.after = cursor
      const page = await this.get<HelixPaginatedResponse<HelixFollowedChannel>>(
        '/channels/followed',
        params
      )
      all.push(...page.data)
      cursor = page.pagination?.cursor
    } while (cursor && all.length < 500)
    return all
  }

  private async getLiveStreams(userIds: string[]): Promise<Map<string, HelixStream>> {
    const map = new Map<string, HelixStream>()
    for (let i = 0; i < userIds.length; i += 100) {
      const chunk = userIds.slice(i, i + 100)
      const url = new URL(`${BASE}/streams`)
      for (const id of chunk) url.searchParams.append('user_id', id)
      url.searchParams.set('first', '100')
      const res = await fetch(url.toString(), { headers: await this.authHeaders() })
      if (!res.ok) continue
      const data = (await res.json()) as { data: HelixStream[] }
      for (const stream of data.data) map.set(stream.user_id, stream)
    }
    return map
  }

  private async getProfileImages(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    for (let i = 0; i < userIds.length; i += 100) {
      const chunk = userIds.slice(i, i + 100)
      const url = new URL(`${BASE}/users`)
      for (const id of chunk) url.searchParams.append('id', id)
      const res = await fetch(url.toString(), { headers: await this.authHeaders() })
      if (!res.ok) continue
      const data = (await res.json()) as { data: HelixUser[] }
      for (const user of data.data) map.set(user.id, user.profile_image_url)
    }
    return map
  }

  async getFollowedWithLiveStatus(): Promise<FollowedChannelInfo[]> {
    const userId = await this.getOwnUserId()
    const followed = await this.getAllFollowed(userId)
    if (followed.length === 0) return []

    const ids = followed.map((f) => f.broadcaster_id)
    const [liveMap, avatarMap] = await Promise.all([
      this.getLiveStreams(ids),
      this.getProfileImages(ids)
    ])

    const channels: FollowedChannelInfo[] = followed.map((f) => {
      const stream = liveMap.get(f.broadcaster_id)
      return {
        broadcasterId: f.broadcaster_id,
        broadcasterLogin: f.broadcaster_login,
        broadcasterName: f.broadcaster_name,
        profileImageUrl: avatarMap.get(f.broadcaster_id) ?? '',
        isLive: !!stream,
        streamTitle: stream?.title,
        gameName: stream?.game_name,
        viewerCount: stream?.viewer_count,
        thumbnailUrl: stream
          ? stream.thumbnail_url
              .replace('{width}', '440')
              .replace('{height}', '248')
          : undefined,
        startedAt: stream?.started_at
      }
    })

    // Live-Kanäle zuerst, dann alphabetisch
    return channels.sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
      return a.broadcasterName.localeCompare(b.broadcasterName)
    })
  }
}
