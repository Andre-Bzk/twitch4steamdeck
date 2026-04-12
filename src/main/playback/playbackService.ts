import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { spawnStreamlink, getStreamUrl, spawnMpv } from './streamlink'
import { getMpvIpcPath, MpvController } from './mpvController'
import type { PlaybackEvent } from './types'
import * as history from '../store/historyRepo'

const POSITION_WRITE_INTERVAL_MS = 5_000

interface CurrentPlayback {
  process: ChildProcess
  mpv: MpvController
  pendingRelativeSeekSeconds: number
  pendingAbsoluteSeekSeconds: number | null
  seekFlushTimer: NodeJS.Timeout | null
  seekVerifyTimer?: NodeJS.Timeout | null
  stopPolling?: (() => void) | null
}

const SEEK_FLUSH_DELAY_MS = 180

export class PlaybackService extends EventEmitter {
  private current: CurrentPlayback | null = null
  private readonly ipcPath = getMpvIpcPath()

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
      pendingRelativeSeekSeconds: 0,
      pendingAbsoluteSeekSeconds: null,
      seekFlushTimer: null
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
    const proc = spawnMpv(hlsUrl, { ipcPath: this.ipcPath })

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
      pendingRelativeSeekSeconds: 0,
      pendingAbsoluteSeekSeconds: null,
      seekFlushTimer: null
    }
    this.emit('playback-event', { kind: 'started' } satisfies PlaybackEvent)

    // IPC verbinden, initialen Resume-Seek erst nach `file-loaded` setzen und Position tracken.
    // HLS-VODs reagieren auf Linux/Steam Deck robuster auf einen Seek nach dem Laden
    // als auf `mpv --start=<sek>`.
    mpv.connect().then(() => {
      let initialSeekDone = effectiveStart <= 0

      // playback-restart feuert nach dem ersten dekodierten Frame —
      // sicherer als file-loaded, weil der HLS-Demuxer dann bereit ist.
      mpv.onEvent('playback-restart', () => {
        if (initialSeekDone) return
        initialSeekDone = true
        mpv.seekAbsolute(effectiveStart)

        // Nach 5s prüfen ob der Seek geklappt hat, sonst Retry
        const verifyTimer = setTimeout(async () => {
          if (this.current) this.current.seekVerifyTimer = null
          const pos = await mpv.getTimePos()
          if (pos !== null && effectiveStart > 30 && Math.abs(pos - effectiveStart) > 30) {
            console.warn(`[mpv] Seek verify: at ${pos}, expected ~${effectiveStart}. Retry.`)
            mpv.seekAbsolute(effectiveStart)
          }
        }, 5000)
        if (this.current) this.current.seekVerifyTimer = verifyTimer
      })

      // Position-Tracking
      let lastWrite = 0
      const writePosition = (seconds: number): void => {
        const now = Date.now()
        if (now - lastWrite < POSITION_WRITE_INTERVAL_MS) return
        lastWrite = now
        const pos = Math.floor(seconds)
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
    const { process: proc, mpv, seekFlushTimer, seekVerifyTimer, stopPolling } = this.current
    this.current = null

    if (seekFlushTimer) clearTimeout(seekFlushTimer)
    if (seekVerifyTimer) clearTimeout(seekVerifyTimer)
    if (stopPolling) stopPolling()
    try { mpv.quit() } catch { /* ignore */ }
    mpv.disconnect()

    await new Promise<void>((r) => setTimeout(r, 400))
    if (!proc.killed) proc.kill()
  }

  stopAll(): void {
    this.stop().catch(() => {})
  }

  private scheduleSeekFlush(): void {
    if (!this.current) return
    if (this.current.seekFlushTimer) {
      clearTimeout(this.current.seekFlushTimer)
    }

    this.current.seekFlushTimer = setTimeout(() => {
      if (!this.current) return
      this.current.seekFlushTimer = null

      const absoluteSeek = this.current.pendingAbsoluteSeekSeconds
      if (absoluteSeek !== null) {
        this.current.pendingAbsoluteSeekSeconds = null
        this.current.mpv.seekAbsolute(absoluteSeek)
        return
      }

      const relativeSeek = this.current.pendingRelativeSeekSeconds
      this.current.pendingRelativeSeekSeconds = 0
      if (relativeSeek !== 0) {
        this.current.mpv.seek(relativeSeek)
      }
    }, SEEK_FLUSH_DELAY_MS)
  }

}
