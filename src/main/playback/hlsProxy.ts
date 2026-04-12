import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

interface ProxySession {
  sourceUrl: string
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function resolveUrl(baseUrl: string, value: string): string {
  if (isAbsoluteUrl(value)) return value
  return new URL(value, baseUrl).toString()
}

function rewriteTagUris(line: string, baseUrl: string, sessionId: string): string {
  return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
    const absoluteUrl = resolveUrl(baseUrl, uri)
    const proxied = `/segment/${sessionId}?url=${encodeURIComponent(absoluteUrl)}`
    return `URI="${proxied}"`
  })
}

async function readResponseText(res: Response): Promise<string> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  return await res.text()
}

export class HlsProxyServer {
  private server = createServer((req, res) => {
    void this.handleRequest(req, res)
  })

  private readonly sessions = new Map<string, ProxySession>()
  private port: number | null = null
  private listenPromise: Promise<void> | null = null

  private async ensureListening(): Promise<void> {
    if (this.port !== null) return
    if (!this.listenPromise) {
      this.listenPromise = new Promise((resolve, reject) => {
        this.server.once('error', reject)
        this.server.listen(0, '127.0.0.1', () => {
          this.server.off('error', reject)
          const address = this.server.address()
          if (!address || typeof address === 'string') {
            reject(new Error('HLS-Proxy konnte keinen Port binden'))
            return
          }
          this.port = address.port
          resolve()
        })
      })
    }
    await this.listenPromise
  }

  async createSession(sourceUrl: string): Promise<string> {
    await this.ensureListening()
    const sessionId = randomUUID()
    this.sessions.set(sessionId, { sourceUrl })
    return `http://127.0.0.1:${this.port}/playlist/${sessionId}.m3u8`
  }

  removeSession(playlistUrl: string | null | undefined): void {
    if (!playlistUrl) return
    const match = /\/playlist\/([^/.]+)\.m3u8$/i.exec(playlistUrl)
    if (!match) return
    this.sessions.delete(match[1])
  }

  close(): void {
    this.sessions.clear()
    if (this.port !== null) {
      this.server.close()
    }
    this.port = null
    this.listenPromise = null
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (requestUrl.pathname.startsWith('/playlist/')) {
        await this.handlePlaylistRequest(requestUrl, res)
        return
      }
      if (requestUrl.pathname.startsWith('/segment/')) {
        await this.handlePassthroughRequest(requestUrl, req, res)
        return
      }
      res.writeHead(404).end('Not found')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.writeHead(500).end(message)
    }
  }

  private async handlePlaylistRequest(requestUrl: URL, res: ServerResponse): Promise<void> {
    const match = /\/playlist\/([^/.]+)\.m3u8$/i.exec(requestUrl.pathname)
    if (!match) {
      res.writeHead(404).end('Unknown playlist')
      return
    }

    const session = this.sessions.get(match[1])
    if (!session) {
      res.writeHead(404).end('Session expired')
      return
    }

    const upstream = await fetch(session.sourceUrl, {
      headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain' }
    })
    const body = await readResponseText(upstream)
    const rewritten = this.rewritePlaylist(body, session.sourceUrl, match[1])

    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store'
    })
    res.end(rewritten)
  }

  private rewritePlaylist(body: string, sourceUrl: string, sessionId: string): string {
    const lines = body.split(/\r?\n/)
    const output: string[] = []
    let insertedPlaylistType = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0) {
        output.push('')
        continue
      }

      if (trimmed.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
        insertedPlaylistType = true
        output.push(line)
        continue
      }

      if (trimmed.startsWith('#')) {
        output.push(rewriteTagUris(line, sourceUrl, sessionId))
        continue
      }

      const absoluteUrl = resolveUrl(sourceUrl, trimmed)
      output.push(`/segment/${sessionId}?url=${encodeURIComponent(absoluteUrl)}`)
    }

    if (!insertedPlaylistType) {
      const headerIndex = output.findIndex((line) => line.startsWith('#EXTM3U'))
      if (headerIndex >= 0) {
        output.splice(headerIndex + 1, 0, '#EXT-X-PLAYLIST-TYPE:VOD')
      }
    }

    return output.join('\n')
  }

  private async handlePassthroughRequest(
    requestUrl: URL,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const upstreamUrl = requestUrl.searchParams.get('url')
    if (!upstreamUrl || !isAbsoluteUrl(upstreamUrl)) {
      res.writeHead(400).end('Missing upstream URL')
      return
    }

    const headers = new Headers()
    const range = req.headers.range
    if (typeof range === 'string' && range.length > 0) {
      headers.set('Range', range)
    }
    const userAgent = req.headers['user-agent']
    if (typeof userAgent === 'string' && userAgent.length > 0) {
      headers.set('User-Agent', userAgent)
    }

    const upstream = await fetch(upstreamUrl, { headers })
    const responseHeaders: Record<string, string> = {
      'Cache-Control': 'no-store'
    }
    for (const [key, value] of upstream.headers.entries()) {
      if (key.toLowerCase() === 'transfer-encoding') continue
      responseHeaders[key] = value
    }

    res.writeHead(upstream.status, responseHeaders)
    if (!upstream.body) {
      res.end()
      return
    }

    for await (const chunk of upstream.body as AsyncIterable<Uint8Array>) {
      res.write(chunk)
    }
    res.end()
  }
}
