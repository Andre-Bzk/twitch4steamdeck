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
}

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
    this.current = { process: proc, mpv }
    this.emit('playback-event', { kind: 'started', channelLogin } satisfies PlaybackEvent)
  }

  async startVod(
    vodId: string,
    channelLogin: string,
    title: string,
    durationSeconds: number
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

    const proc = spawnMpv(hlsUrl, { ipcPath: this.ipcPath, startSeconds: resumePos })

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
    this.current = { process: proc, mpv }
    this.emit('playback-event', { kind: 'started' } satisfies PlaybackEvent)

    // IPC verbinden und Position tracken
    mpv.connect().then(() => {
      let lastWrite = 0
      mpv.observeTimePos((seconds) => {
        const now = Date.now()
        if (now - lastWrite < POSITION_WRITE_INTERVAL_MS) return
        lastWrite = now
        const pos = Math.floor(seconds)
        history.updatePosition(vodId, pos)
        if (durationSeconds > 0 && pos / durationSeconds > 0.95) {
          history.markCompleted(vodId)
        }
      })
    }).catch(() => {
      console.warn('[mpv] IPC nicht verfügbar — Resume-Tracking deaktiviert')
    })
  }

  async stop(): Promise<void> {
    if (!this.current) return
    const { process: proc, mpv } = this.current
    this.current = null

    try { mpv.quit() } catch { /* ignore */ }
    mpv.disconnect()

    await new Promise<void>((r) => setTimeout(r, 400))
    if (!proc.killed) proc.kill()
  }

  stopAll(): void {
    this.stop().catch(() => {})
  }

}
