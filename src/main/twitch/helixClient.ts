import type {
  FollowedChannelInfo,
  GameInfo,
  HelixFollowedChannel,
  HelixGame,
  HelixPaginatedResponse,
  HelixStream,
  OwnUserInfo,
  TopStreamsResult,
  HelixUser,
  HelixVideo,
  VodChapter,
  VodInfo
} from './types'

function parseDuration(d: string): number {
  let s = 0
  const h = d.match(/(\d+)h/)
  const m = d.match(/(\d+)m/)
  const sec = d.match(/(\d+)s/)
  if (h) s += parseInt(h[1]) * 3600
  if (m) s += parseInt(m[1]) * 60
  if (sec) s += parseInt(sec[1])
  return s
}

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

  async getOwnUserInfo(): Promise<OwnUserInfo> {
    const user = await this.getOwnUser()
    return {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url
    }
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

  async getVideos(broadcasterId: string, limit = 20): Promise<VodInfo[]> {
    const data = await this.get<HelixPaginatedResponse<HelixVideo>>('/videos', {
      user_id: broadcasterId,
      type: 'archive',
      first: String(limit)
    })
    return data.data.map((v) => ({
      id: v.id,
      title: v.title,
      createdAt: v.created_at,
      durationSeconds: parseDuration(v.duration),
      viewCount: v.view_count,
      thumbnailUrl: v.thumbnail_url
        .replace('%{width}', '440')
        .replace('%{height}', '248')
    }))
  }

  async getTopGames(
    limit = 40,
    cursor?: string
  ): Promise<{ games: GameInfo[]; cursor?: string }> {
    const params: Record<string, string> = { first: String(limit) }
    if (cursor) params.after = cursor

    const data = await this.get<HelixPaginatedResponse<HelixGame>>('/games/top', params)
    const games = data.data.map((g) => ({
      id: g.id,
      name: g.name,
      boxArtUrl: g.box_art_url.replace('{width}', '285').replace('{height}', '380')
    }))

    // Zuschauerzahlen: pro Kategorie die Top-100-Streams abrufen (parallel)
    const headers = await this.authHeaders()
    const viewerCounts = await Promise.all(
      games.map(async (g) => {
        try {
          const url = new URL(`${BASE}/streams`)
          url.searchParams.set('game_id', g.id)
          url.searchParams.set('first', '100')
          const res = await fetch(url.toString(), { headers })
          if (!res.ok) return undefined
          const d = (await res.json()) as { data: HelixStream[] }
          return d.data.reduce((sum, s) => sum + s.viewer_count, 0)
        } catch {
          return undefined
        }
      })
    )

    return {
      games: games.map((g, i) => ({ ...g, viewerCount: viewerCounts[i] })),
      cursor: data.pagination?.cursor
    }
  }

  async getTopStreams(opts?: {
    gameId?: string
    language?: string
    limit?: number
    cursor?: string
  }): Promise<TopStreamsResult> {
    const params: Record<string, string> = { first: String(opts?.limit ?? 20) }
    if (opts?.gameId) params.game_id = opts.gameId
    if (opts?.language) params.language = opts.language
    if (opts?.cursor) params.after = opts.cursor

    const url = new URL(`${BASE}/streams`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: await this.authHeaders() })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Helix /streams → ${res.status}: ${body}`)
    }
    const data = (await res.json()) as HelixPaginatedResponse<HelixStream>
    const streams = data.data

    const userIds = streams.map((s) => s.user_id)
    const avatarMap = await this.getProfileImages(userIds)

    return {
      streams: streams.map((s) => ({
      broadcasterId: s.user_id,
      broadcasterLogin: s.user_login,
      broadcasterName: s.user_name,
      profileImageUrl: avatarMap.get(s.user_id) ?? '',
      isLive: true,
      streamTitle: s.title,
      gameId: s.game_id,
      gameName: s.game_name,
      viewerCount: s.viewer_count,
      thumbnailUrl: s.thumbnail_url.replace('{width}', '440').replace('{height}', '248'),
      startedAt: s.started_at,
      language: s.language
      })),
      cursor: data.pagination?.cursor
    }
  }

  private static readonly GQL_URL = 'https://gql.twitch.tv/gql'
  // GQL requires the Twitch web client ID — the Helix app client ID is not accepted here
  private static readonly GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'
  private static readonly CHAPTERS_QUERY =
    'query VideoPlayer_ChapterSelectButtonVideo($videoID: ID!) {' +
    '  video(id: $videoID) {' +
    '    moments(momentRequestType: VIDEO_CHAPTER_MARKERS) {' +
    '      edges { node {' +
    '        positionMilliseconds durationMilliseconds description type' +
    '        details { ... on GameChangeMomentDetails { game { id name } } }' +
    '      } }' +
    '    }' +
    '  }' +
    '}'

  async getVodChapters(videoId: string): Promise<VodChapter[]> {
    try {
      const res = await fetch(HelixClient.GQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': HelixClient.GQL_CLIENT_ID
        },
        body: JSON.stringify([{
          operationName: 'VideoPlayer_ChapterSelectButtonVideo',
          variables: { videoID: videoId },
          query: HelixClient.CHAPTERS_QUERY
        }])
      })
      if (!res.ok) return []
      const json = await res.json() as Array<{
        data?: { video?: { moments?: { edges: Array<{ node: {
          positionMilliseconds: number
          durationMilliseconds: number
          description: string
          details?: { game?: { id: string; name: string } | null }
        }}> } } }
        errors?: Array<{ message: string }>
      }>
      const payload = json[0]
      if (!payload || payload.errors?.length || !payload.data?.video?.moments) return []
      return payload.data.video.moments.edges.map(({ node }) => ({
        positionSeconds: Math.floor(node.positionMilliseconds / 1000),
        durationSeconds: Math.floor(node.durationMilliseconds / 1000),
        gameName: node.details?.game?.name ?? node.description,
        gameId: node.details?.game?.id ?? null
      }))
    } catch {
      return []
    }
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
        gameId: stream?.game_id,
        gameName: stream?.game_name,
        viewerCount: stream?.viewer_count,
        thumbnailUrl: stream
          ? stream.thumbnail_url
              .replace('{width}', '440')
              .replace('{height}', '248')
          : undefined,
        startedAt: stream?.started_at,
        language: stream?.language
      }
    })

    // Live-Kanäle zuerst, dann alphabetisch
    return channels.sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
      return a.broadcasterName.localeCompare(b.broadcasterName)
    })
  }
}
