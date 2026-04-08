import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { spawnStreamlink } from './streamlink'
import { getMpvIpcPath, MpvController } from './mpvController'
import type { PlaybackEvent } from './types'
interface CurrentPlayback {
  channelLogin: string
  streamlink: ChildProcess
  mpv: MpvController
}

export class PlaybackService extends EventEmitter {
  private current: CurrentPlayback | null = null
  private readonly ipcPath = getMpvIpcPath()

  constructor() {
    super()
  }

  async startLive(channelLogin: string, quality = 'best'): Promise<void> {
    if (this.current) {
      await this.stop()
    }

    const sl = spawnStreamlink({
      channelLogin,
      quality,
      mpvIpcPath: this.ipcPath
    })

    sl.stdout?.on('data', (d: Buffer) => {
      console.log('[streamlink stdout]', d.toString().trim())
    })

    sl.stderr?.on('data', (d: Buffer) => {
      console.log('[streamlink stderr]', d.toString().trim())
    })

    sl.on('error', (e: Error) => {
      console.error('[streamlink] spawn error:', e)
      if (this.current?.streamlink === sl) this.current = null
      this.emit('playback-event', {
        kind: 'error',
        message: `streamlink Fehler: ${e.message}`
      } satisfies PlaybackEvent)
    })

    sl.on('exit', (code) => {
      if (this.current?.streamlink === sl) this.current = null
      if (code !== 0 && code !== null) {
        console.warn('[streamlink] exit code', code)
      }
      this.emit('playback-event', { kind: 'stopped' } satisfies PlaybackEvent)
    })

    const mpv = new MpvController(this.ipcPath)
    this.current = { channelLogin, streamlink: sl, mpv }

    this.emit('playback-event', {
      kind: 'started',
      channelLogin
    } satisfies PlaybackEvent)

    // IPC-Verbindung zu mpv im Hintergrund (nicht blockierend, nicht kritisch)
    mpv.connect().catch(() => {})
  }

  async stop(): Promise<void> {
    if (!this.current) return
    const { streamlink: sl, mpv } = this.current
    this.current = null

    try {
      mpv.quit()
    } catch {
      /* ignore */
    }
    mpv.disconnect()

    await new Promise<void>((r) => setTimeout(r, 400))

    if (!sl.killed) {
      sl.kill()
    }
  }

  stopAll(): void {
    this.stop().catch(() => {})
  }
}
