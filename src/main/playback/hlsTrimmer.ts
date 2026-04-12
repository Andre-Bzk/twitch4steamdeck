/**
 * Erzeugt eine gekürzte HLS-Playlist, die erst ab einem Zielsegment beginnt.
 * Umgeht den FFmpeg 7.0.3 fMP4-Seek-Bug: mpv startet nahe der Zielposition
 * ohne einen Seek im HLS-Demuxer ausführen zu müssen.
 *
 * Wichtig: Die Playlist wird über localhost ausgeliefert statt als lokale Datei.
 * FFmpeg blockiert bei file://-HLS-Playlists ansonsten https-Subrequests
 * (Protocol-Whitelist: nur file,crypto,data).
 */

import * as http from 'node:http'

interface HlsSegment {
  duration: number
  uri: string
  /** Zusätzliche Tags vor dem Segment (z.B. #EXT-X-BYTERANGE) */
  tags: string[]
}

interface ParsedPlaylist {
  headerLines: string[]
  mapLine: string | null
  segments: HlsSegment[]
  mediaSequence: number
  hasEndList: boolean
}

function resolveUrl(base: string, relative: string): string {
  if (/^https?:\/\//i.test(relative)) return relative
  return new URL(relative, base).toString()
}

function parsePlaylist(text: string, baseUrl: string): ParsedPlaylist {
  const lines = text.split(/\r?\n/)
  const headerLines: string[] = []
  let mapLine: string | null = null
  const segments: HlsSegment[] = []
  let mediaSequence = 0
  let hasEndList = false

  let pendingDuration: number | null = null
  let pendingTags: string[] = []
  let inHeader = true

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed === '#EXT-X-ENDLIST') {
      hasEndList = true
      continue
    }

    if (trimmed.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = parseInt(trimmed.split(':')[1], 10) || 0
      // Nicht in headerLines aufnehmen — wird neu berechnet
      continue
    }

    if (trimmed.startsWith('#EXT-X-MAP:')) {
      // Init-Segment URI absolut auflösen
      mapLine = trimmed.replace(/URI="([^"]+)"/, (_m, uri: string) => {
        return `URI="${resolveUrl(baseUrl, uri)}"`
      })
      inHeader = false
      continue
    }

    if (trimmed.startsWith('#EXTINF:')) {
      inHeader = false
      const durationStr = trimmed.replace('#EXTINF:', '').replace(',', '')
      pendingDuration = parseFloat(durationStr)
      continue
    }

    // Segment-URI (kein #-Prefix)
    if (!trimmed.startsWith('#') && pendingDuration !== null) {
      segments.push({
        duration: pendingDuration,
        uri: resolveUrl(baseUrl, trimmed),
        tags: pendingTags
      })
      pendingDuration = null
      pendingTags = []
      continue
    }

    // Sonstige Tags
    if (trimmed.startsWith('#')) {
      if (inHeader) {
        headerLines.push(trimmed)
      } else if (pendingDuration === null) {
        // Tag zwischen Segmenten (z.B. #EXT-X-DISCONTINUITY)
        pendingTags.push(trimmed)
      } else {
        // Tag direkt vor einem Segment (z.B. #EXT-X-BYTERANGE)
        pendingTags.push(trimmed)
      }
    }
  }

  return { headerLines, mapLine, segments, mediaSequence, hasEndList }
}

export interface TrimResult {
  url: string
  /** Absolute Zeit (Sekunden) ab der die gekürzte Playlist beginnt */
  playlistStartSeconds: number
  close: () => Promise<void>
}

/**
 * Erstellt eine gekürzte HLS-Playlist die ab ~targetSeconds beginnt.
 * Liefert sie über einen lokalen HTTP-Server aus und gibt URL + Startzeit zurück.
 */
export async function createTrimmedPlaylist(
  hlsUrl: string,
  targetSeconds: number
): Promise<TrimResult> {
  const res = await fetch(hlsUrl, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`HLS-Playlist fetch failed: ${res.status}`)
  const text = await res.text()

  const playlist = parsePlaylist(text, hlsUrl)

  // Zielsegment finden
  let cumulative = 0
  let targetIndex = 0
  for (let i = 0; i < playlist.segments.length; i++) {
    if (cumulative + playlist.segments[i].duration > targetSeconds) {
      targetIndex = i
      break
    }
    cumulative += playlist.segments[i].duration
    if (i === playlist.segments.length - 1) {
      targetIndex = i
      cumulative -= playlist.segments[i].duration
    }
  }

  // Für fMP4 keinen zusätzlichen Warmup-Segmentpuffer verwenden.
  // Jeder nachgelagerte Seek triggert sonst wieder den gleichen Demuxer-Bug.
  const trimStart = targetIndex

  // playlistStartSeconds = Summe der Dauer aller übersprungenen Segmente
  let playlistStartSeconds = 0
  for (let i = 0; i < trimStart; i++) {
    playlistStartSeconds += playlist.segments[i].duration
  }

  // Neue Playlist zusammenbauen
  const lines: string[] = []

  // Header
  for (const h of playlist.headerLines) {
    lines.push(h)
  }
  // EXT-X-PLAYLIST-TYPE:VOD sicherstellen
  if (!playlist.headerLines.some((l) => l.startsWith('#EXT-X-PLAYLIST-TYPE'))) {
    lines.push('#EXT-X-PLAYLIST-TYPE:VOD')
  }
  // Media-Sequence passend setzen
  lines.push(`#EXT-X-MEDIA-SEQUENCE:${playlist.mediaSequence + trimStart}`)

  // Init-Segment (EXT-X-MAP)
  if (playlist.mapLine) {
    lines.push(playlist.mapLine)
  }

  // Segmente ab trimStart
  for (let i = trimStart; i < playlist.segments.length; i++) {
    const seg = playlist.segments[i]
    for (const tag of seg.tags) {
      lines.push(tag)
    }
    lines.push(`#EXTINF:${seg.duration.toFixed(3)},`)
    lines.push(seg.uri)
  }

  if (playlist.hasEndList) {
    lines.push('#EXT-X-ENDLIST')
  }

  const playlistText = lines.join('\n')
  const route = `/trimmed-${Date.now()}-${Math.random().toString(36).slice(2)}.m3u8`

  const server = http.createServer((req, res) => {
    if (req.url !== route) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    res.end(playlistText)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('trimmed playlist server address unavailable')
  }

  return {
    url: `http://127.0.0.1:${address.port}${route}`,
    playlistStartSeconds,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
}

export async function cleanupTrimmedPlaylist(trimmed: TrimResult | null): Promise<void> {
  if (!trimmed) return
  try {
    await trimmed.close()
  } catch {
    // Bereits geschlossen — OK
  }
}
