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
// Relative Seeks > 60s nutzen bei fMP4 loadFile statt seek (umgeht Demuxer-Bug)
const FMP4_LOADFILE_THRESHOLD_S = 60

interface CurrentPlayback {
  process: ChildProcess
  mpv: MpvController
  hlsUrl: string
  isFmp4: boolean
  playbackOffsetSeconds: number
  pendingRelativeSeekSeconds: number
  pendingAbsoluteSeekSeconds: number | null
  seekFlushTimer: NodeJS.Timeout | null
  trimmedPlaylist: TrimResult | null
  stopPolling?: (() => void) | null
}

const SEEK_FLUSH_DELAY_MS = 180

/** Prüft ob ein HLS-Manifest fMP4-Segmente nutzt (EXT-X-MAP → init-Segment). */
async function detectFmp4(hlsUrl: string): Promise<boolean> {
  try {
    const res = await fetch(hlsUrl, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return true // im Zweifel fMP4 annehmen (loadFile ist sicher)
    const text = await res.text()
    return text.includes('#EXT-X-MAP')
  } catch {
    return true
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
      pendingRelativeSeekSeconds: 0,
      pendingAbsoluteSeekSeconds: null,
      seekFlushTimer: null,
      trimmedPlaylist: null
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
    const isFmp4 = await detectFmp4(hlsUrl)

    // fMP4 + großer Resume: Gekürzte Playlist erstellen, die ab dem Zielsegment beginnt.
    // Umgeht den FFmpeg HLS-Demuxer fMP4-Seek-Bug komplett — kein Seek nötig.
    let mpvUrl = hlsUrl
    let trimmedPlaylist: TrimResult | null = null
    let playbackOffsetSeconds = 0
    if (isFmp4 && effectiveStart > 20) {
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
      pendingRelativeSeekSeconds: 0,
      pendingAbsoluteSeekSeconds: null,
      seekFlushTimer: null,
      trimmedPlaylist
    }
    this.emit('playback-event', { kind: 'started' } satisfies PlaybackEvent)

    // IPC verbinden, initialen Resume-Seek erst nach `playback-restart` setzen und Position tracken.
    mpv.connect().then(() => {
      let initialSeekDone = effectiveStart <= 0 || isFmp4

      // playback-restart feuert nach dem ersten dekodierten Frame.
      mpv.onEvent('playback-restart', () => {
        if (!this.current) return

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
        lastWrite = now
        const absoluteSeconds = seconds + (this.current?.playbackOffsetSeconds ?? 0)
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
    return this.current?.mpv.getTimePos() ?? Promise.resolve(null)
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

  /** fMP4: Gekürzte Playlist erstellen und per loadFile laden (umgeht FFmpeg-Seek-Bug). */
  private async fmp4SeekViaTrimmedPlaylist(targetSeconds: number): Promise<void> {
    if (!this.current) return
    const { hlsUrl } = this.current

    // Alte lokale Playlist-Instanz aufräumen
    if (this.current.trimmedPlaylist) {
      cleanupTrimmedPlaylist(this.current.trimmedPlaylist).catch(() => {})
      this.current.trimmedPlaylist = null
    }

    if (targetSeconds < 20) {
      // Nahe am Anfang: kein Trimming nötig, einfach neu laden
      this.current.playbackOffsetSeconds = 0
      this.current.mpv.loadFile(hlsUrl)
      return
    }

    try {
      const trimmed = await createTrimmedPlaylist(hlsUrl, targetSeconds)
      if (!this.current) return
      this.current.trimmedPlaylist = trimmed
      this.current.playbackOffsetSeconds = trimmed.playlistStartSeconds
      this.current.mpv.loadFile(trimmed.url)
    } catch (e) {
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
          await this.fmp4SeekViaTrimmedPlaylist(absoluteSeek)
        } else {
          this.current.mpv.seekAbsolute(absoluteSeek)
        }
        return
      }

      const relativeSeek = this.current.pendingRelativeSeekSeconds
      this.current.pendingRelativeSeekSeconds = 0
      if (relativeSeek !== 0) {
        if (isFmp4 && Math.abs(relativeSeek) > FMP4_LOADFILE_THRESHOLD_S) {
          const pos = await this.current?.mpv.getTimePos()
          if (pos !== null && this.current) {
            const absolutePos = this.current.playbackOffsetSeconds + pos
            await this.fmp4SeekViaTrimmedPlaylist(Math.max(0, absolutePos + relativeSeek))
          }
        } else {
          this.current.mpv.seek(relativeSeek)
        }
      }
    }, SEEK_FLUSH_DELAY_MS)
  }

}
