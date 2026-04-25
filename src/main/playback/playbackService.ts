import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { app } from 'electron'
import path from 'node:path'
import { spawnStreamlink, getStreamUrl, spawnMpv } from './streamlink'
import { getMpvIpcPath, MpvController } from './mpvController'
import { createTrimmedPlaylist, cleanupTrimmedPlaylist, type TrimResult } from './hlsTrimmer'
import type { PlaybackEvent } from './types'
import * as history from '../store/historyRepo'

const POSITION_WRITE_INTERVAL_MS = 5_000

interface CurrentPlayback {
  process: ChildProcess
  mpv: MpvController
  hlsUrl: string
  isFmp4: boolean
  playbackOffsetSeconds: number
  lastKnownAbsolutePositionSeconds: number | null
  pendingRelativeSeekSeconds: number
  pendingAbsoluteSeekSeconds: number | null
  seekFlushTimer: NodeJS.Timeout | null
  trimmedPlaylist: TrimResult | null
  seekGeneration: number
  loadGeneration: number
  pendingLoadGeneration: number | null
  stopPolling?: (() => void) | null
}

const SEEK_FLUSH_DELAY_MS = 180

interface InspectedVodPlaylist {
  isFmp4: boolean
  isOpenEnded: boolean
}

/**
 * Laufende Twitch-VODs liefern oft eine offene EVENT-/DVR-Playlist.
 * Diese muss lokal als statischer Snapshot eingefroren werden, sonst startet mpv am Live-Rand.
 */
async function inspectVodPlaylist(hlsUrl: string): Promise<InspectedVodPlaylist> {
  try {
    const res = await fetch(hlsUrl, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) {
      return { isFmp4: true, isOpenEnded: false }
    }
    const text = await res.text()
    const playlistTypeMatch = text.match(/^#EXT-X-PLAYLIST-TYPE:(.+)$/m)
    const playlistType = playlistTypeMatch?.[1]?.trim().toUpperCase() ?? null
    const hasEndList = text.includes('#EXT-X-ENDLIST')

    return {
      isFmp4: text.includes('#EXT-X-MAP'),
      isOpenEnded: !hasEndList || playlistType === 'EVENT'
    }
  } catch {
    return { isFmp4: true, isOpenEnded: false }
  }
}

export class PlaybackService extends EventEmitter {
  private current: CurrentPlayback | null = null
  private readonly ipcPath = getMpvIpcPath()
  private readonly mpvLogPath = path.join(app.getPath('userData'), 'mpv.log')
  private loggingEnabled = true

  constructor() {
    super()
  }

  private isReloading(current: CurrentPlayback): boolean {
    return current.seekGeneration !== current.loadGeneration
  }

  private async getAbsolutePlaybackPosition(current: CurrentPlayback): Promise<number | null> {
    if (this.isReloading(current) && current.lastKnownAbsolutePositionSeconds !== null) {
      return current.lastKnownAbsolutePositionSeconds
    }

    const pos = await current.mpv.getTimePos()
    if (this.current !== current) return null
    if (pos === null) return current.lastKnownAbsolutePositionSeconds

    const absolutePos = current.playbackOffsetSeconds + pos
    current.lastKnownAbsolutePositionSeconds = absolutePos
    return absolutePos
  }

  async startLive(channelLogin: string, quality = 'best'): Promise<void> {
    if (this.current) await this.stop()

    const proc = spawnStreamlink(`twitch.tv/${channelLogin}`, quality)

    let stderrBuf = ''
    proc.stdout?.on('data', (d: Buffer) => console.log('[streamlink]', d.toString().trim()))
    proc.stderr?.on('data', (d: Buffer) => {
      const s = d.toString()
      console.log('[streamlink stderr]', s.trim())
      stderrBuf += s
    })

    proc.on('error', (e: Error) => {
      if (this.current?.process === proc) this.current = null
      this.emit('playback-event', {
        kind: 'error',
        message: `streamlink nicht gefunden: ${e.message}`
      } satisfies PlaybackEvent)
    })

    proc.on('exit', (code) => {
      if (this.current?.process === proc) this.current = null
      if (code !== 0 && code !== null) {
        const snippet = stderrBuf.trim().split('\n').slice(-6).join('\n').substring(0, 500)
        this.emit('playback-event', {
          kind: 'error',
          message: `streamlink Exit ${code}:\n${snippet || '(kein Output)'}`
        } satisfies PlaybackEvent)
      } else {
        this.emit('playback-event', { kind: 'stopped' } satisfies PlaybackEvent)
      }
    })

    // Für Live: mpv wird von streamlink gestartet, kein direkter IPC nötig
    const mpv = new MpvController(this.ipcPath)
    this.current = {
      process: proc,
      mpv,
      hlsUrl: '',
      isFmp4: false,
      playbackOffsetSeconds: 0,
      lastKnownAbsolutePositionSeconds: null,
      pendingRelativeSeekSeconds: 0,
      pendingAbsoluteSeekSeconds: null,
      seekFlushTimer: null,
      trimmedPlaylist: null,
      seekGeneration: 0,
      loadGeneration: 0,
      pendingLoadGeneration: null
    }
    this.emit('playback-event', { kind: 'started', channelLogin } satisfies PlaybackEvent)
  }

  async startVod(
    vodId: string,
    channelLogin: string,
    title: string,
    durationSeconds: number,
    startSeconds?: number
  ): Promise<void> {
    if (this.current) await this.stop()

    const resumePos = history.getPosition(vodId)
    history.upsertVod({
      vod_id: vodId,
      channel_login: channelLogin,
      title,
      duration_seconds: durationSeconds,
      watched_at: Date.now()
    })

    let hlsUrl: string
    try {
      hlsUrl = await getStreamUrl(`https://www.twitch.tv/videos/${vodId}`, 'best')
    } catch (e) {
      this.emit('playback-event', {
        kind: 'error',
        message: `Stream-URL konnte nicht abgerufen werden: ${e}`
      } satisfies PlaybackEvent)
      return
    }

    const effectiveStart = startSeconds !== undefined ? startSeconds : resumePos
    const { isFmp4, isOpenEnded } = await inspectVodPlaylist(hlsUrl)

    // Laufende Live-VODs kommen als offene EVENT-/DVR-Playlist zurück.
    // Diese muss unabhängig vom Container als lokaler Snapshot eingefroren werden,
    // sonst startet mpv am Live-Rand statt am VOD-Anfang bzw. Kapitel-Offset.
    // Geschlossene fMP4-VODs nutzen denselben Pfad weiterhin als Seek-Workaround.
    let mpvUrl = hlsUrl
    let trimmedPlaylist: TrimResult | null = null
    let playbackOffsetSeconds = 0
    const shouldStartViaTrimmedPlaylist = isOpenEnded || (isFmp4 && effectiveStart > 20)
    if (shouldStartViaTrimmedPlaylist) {
      try {
        const trim = await createTrimmedPlaylist(hlsUrl, effectiveStart)
        mpvUrl = trim.url
        trimmedPlaylist = trim
        playbackOffsetSeconds = trim.playlistStartSeconds
      } catch (e) {
        console.warn('[playback] Trimmed playlist failed, falling back to original URL:', e)
      }
    }

    const proc = spawnMpv(mpvUrl, {
      ipcPath: this.ipcPath,
      logPath: this.loggingEnabled ? this.mpvLogPath : undefined
    })

    let mpvStderrBuf = ''
    proc.stdout?.on('data', (d: Buffer) => console.log('[mpv]', d.toString().trim()))
    proc.stderr?.on('data', (d: Buffer) => {
      const s = d.toString()
      console.log('[mpv stderr]', s.trim())
      mpvStderrBuf += s
    })

    proc.on('error', (e: Error) => {
      if (this.current?.process === proc) this.current = null
      this.emit('playback-event', {
        kind: 'error',
        message: `mpv nicht gefunden: ${e.message}`
      } satisfies PlaybackEvent)
    })

    proc.on('exit', (code) => {
      if (this.current?.process === proc) this.current = null
      if (code !== 0 && code !== null) {
        const snippet = mpvStderrBuf.trim().split('\n').slice(-6).join('\n').substring(0, 500)
        this.emit('playback-event', {
          kind: 'error',
          message: `mpv Exit ${code}:\n${snippet || '(kein Output)'}`
        } satisfies PlaybackEvent)
      } else {
        this.emit('playback-event', { kind: 'stopped' } satisfies PlaybackEvent)
      }
    })

    const mpv = new MpvController(this.ipcPath)
    this.current = {
      process: proc,
      mpv,
      hlsUrl,
      isFmp4,
      playbackOffsetSeconds,
      lastKnownAbsolutePositionSeconds: effectiveStart > 0 ? effectiveStart : 0,
      pendingRelativeSeekSeconds: 0,
      pendingAbsoluteSeekSeconds: null,
      seekFlushTimer: null,
      trimmedPlaylist,
      seekGeneration: 0,
      loadGeneration: 0,
      pendingLoadGeneration: null
    }
    this.emit('playback-event', { kind: 'started' } satisfies PlaybackEvent)

    // IPC verbinden, initialen Resume-Seek erst nach `playback-restart` setzen und Position tracken.
    mpv.connect().then(() => {
      let initialSeekDone = effectiveStart <= 0 || shouldStartViaTrimmedPlaylist || isFmp4

      if (!shouldStartViaTrimmedPlaylist && isFmp4 && effectiveStart > 0 && effectiveStart < 20) {
        void this.reloadFmp4AtAbsolutePosition(effectiveStart)
      }

      // playback-restart feuert nach dem ersten dekodierten Frame.
      mpv.onEvent('playback-restart', () => {
        if (!this.current || this.current.mpv !== mpv) return

        if (this.current.pendingLoadGeneration !== null) {
          this.current.loadGeneration = this.current.pendingLoadGeneration
          this.current.pendingLoadGeneration = null
        }

        // Initialer Seek für TS-Streams (fMP4 wird über Trimmed-Playlist gelöst)
        if (initialSeekDone) return
        initialSeekDone = true
        mpv.seekAbsolute(effectiveStart)
      })

      // Position-Tracking
      let lastWrite = 0
      const writePosition = (seconds: number): void => {
        const now = Date.now()
        if (now - lastWrite < POSITION_WRITE_INTERVAL_MS) return
        if (!this.current || this.current.mpv !== mpv) return
        if (this.isReloading(this.current)) return

        lastWrite = now
        const absoluteSeconds = seconds + this.current.playbackOffsetSeconds
        this.current.lastKnownAbsolutePositionSeconds = absoluteSeconds
        const pos = Math.floor(absoluteSeconds)
        history.updatePosition(vodId, pos)
        if (durationSeconds > 0 && pos / durationSeconds > 0.95) {
          history.markCompleted(vodId)
        }
      }

      mpv.observeTimePos(writePosition)

      // Fallback: Falls observe_property nie feuert, nach 10s auf Polling wechseln
      setTimeout(() => {
        if (lastWrite === 0 && this.current?.mpv === mpv) {
          console.warn('[mpv] observe_property time-pos nicht aktiv, starte Poll-Fallback')
          const stop = mpv.pollTimePos(POSITION_WRITE_INTERVAL_MS, writePosition)
          if (this.current) this.current.stopPolling = stop
        }
      }, 10_000)
    }).catch(() => {
      console.warn('[mpv] IPC nicht verfügbar — Resume-Tracking deaktiviert')
    })
  }

  seek(seconds: number): void {
    if (!this.current) return
    this.current.pendingRelativeSeekSeconds += seconds
    this.current.pendingAbsoluteSeekSeconds = null
    this.scheduleSeekFlush()
  }

  togglePause(): void {
    this.current?.mpv.togglePause()
  }

  pause(): void {
    this.current?.mpv.setPause(true)
  }

  resume(): void {
    this.current?.mpv.setPause(false)
  }

  seekTo(seconds: number): void {
    if (!this.current) return
    this.current.pendingRelativeSeekSeconds = 0
    this.current.pendingAbsoluteSeekSeconds = seconds
    this.scheduleSeekFlush()
  }

  getCurrentPosition(): Promise<number | null> {
    if (!this.current) return Promise.resolve(null)
    return this.getAbsolutePlaybackPosition(this.current)
  }

  async stop(): Promise<void> {
    if (!this.current) return
    const { process: proc, mpv, seekFlushTimer, trimmedPlaylist, stopPolling } = this.current
    this.current = null

    if (seekFlushTimer) clearTimeout(seekFlushTimer)
    if (stopPolling) stopPolling()
    cleanupTrimmedPlaylist(trimmedPlaylist).catch(() => {})
    try { mpv.quit() } catch { /* ignore */ }
    mpv.disconnect()

    await new Promise<void>((r) => setTimeout(r, 400))
    if (!proc.killed) proc.kill()
  }

  stopAll(): void {
    this.stop().catch(() => {})
  }

  setLoggingEnabled(enabled: boolean): void {
    this.loggingEnabled = enabled
  }

  getLogPath(): string {
    return this.mpvLogPath
  }

  /** fMP4: Auf eine absolute VOD-Zeit neu laden, ohne mpv-internen HLS-Seek zu verwenden. */
  private async reloadFmp4AtAbsolutePosition(targetSeconds: number): Promise<void> {
    if (!this.current) return

    const current = this.current
    const generation = current.seekGeneration + 1
    const normalizedTarget = Math.max(0, targetSeconds)
    const previousTrimmed = current.trimmedPlaylist
    const previousAbsolutePosition = current.lastKnownAbsolutePositionSeconds

    current.seekGeneration = generation
    current.lastKnownAbsolutePositionSeconds = normalizedTarget

    if (normalizedTarget < 20) {
      current.playbackOffsetSeconds = 0
      current.trimmedPlaylist = null
      current.pendingLoadGeneration = generation
      current.mpv.loadFile(current.hlsUrl, normalizedTarget > 0 ? normalizedTarget : undefined)
      cleanupTrimmedPlaylist(previousTrimmed).catch(() => {})
      return
    }

    try {
      const trimmed = await createTrimmedPlaylist(current.hlsUrl, normalizedTarget)
      if (this.current !== current || current.seekGeneration !== generation) {
        await cleanupTrimmedPlaylist(trimmed)
        return
      }

      current.playbackOffsetSeconds = trimmed.playlistStartSeconds
      current.trimmedPlaylist = trimmed
      current.pendingLoadGeneration = generation
      current.mpv.loadFile(trimmed.url)
      cleanupTrimmedPlaylist(previousTrimmed).catch(() => {})
    } catch (e) {
      if (this.current === current && current.seekGeneration === generation) {
        current.seekGeneration = current.loadGeneration
        current.pendingLoadGeneration = null
        current.lastKnownAbsolutePositionSeconds = previousAbsolutePosition
      }
      console.warn('[playback] Trimmed playlist failed:', e)
    }
  }

  private scheduleSeekFlush(): void {
    if (!this.current) return
    if (this.current.seekFlushTimer) {
      clearTimeout(this.current.seekFlushTimer)
    }

    this.current.seekFlushTimer = setTimeout(async () => {
      if (!this.current) return
      this.current.seekFlushTimer = null

      const { isFmp4 } = this.current

      const absoluteSeek = this.current.pendingAbsoluteSeekSeconds
      if (absoluteSeek !== null) {
        this.current.pendingAbsoluteSeekSeconds = null
        if (isFmp4) {
          await this.reloadFmp4AtAbsolutePosition(absoluteSeek)
        } else {
          this.current.mpv.seekAbsolute(absoluteSeek)
        }
        return
      }

      const relativeSeek = this.current.pendingRelativeSeekSeconds
      this.current.pendingRelativeSeekSeconds = 0
      if (relativeSeek !== 0) {
        if (isFmp4) {
          const absolutePos = await this.getAbsolutePlaybackPosition(this.current)
          if (absolutePos !== null && this.current) {
            await this.reloadFmp4AtAbsolutePosition(absolutePos + relativeSeek)
          }
        } else {
          this.current.mpv.seek(relativeSeek)
        }
      }
    }, SEEK_FLUSH_DELAY_MS)
  }

}
