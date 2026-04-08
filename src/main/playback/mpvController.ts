import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'

export function getMpvIpcPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\twitch4sd-mpv'
  }
  return path.join(os.tmpdir(), 'twitch4sd-mpv.sock')
}

export class MpvController {
  private socket: net.Socket | null = null
  private buf = ''

  constructor(private ipcPath: string) {}

  async connect(retries = 12, delayMs = 250): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this._tryConnect()
        return
      } catch {
        if (i < retries - 1) {
          await new Promise<void>((r) => setTimeout(r, delayMs))
        }
      }
    }
    console.warn('[mpv] IPC connect failed after', retries, 'retries — continuing without IPC')
  }

  private _tryConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ path: this.ipcPath })
      sock.once('connect', () => {
        this.socket = sock
        sock.on('error', () => { /* ignore socket errors after connect */ })
        resolve()
      })
      sock.once('error', reject)
    })
  }

  /** Beobachtet time-pos; ruft cb mit Sekunden auf. Throttling liegt beim Aufrufer. */
  observeTimePos(cb: (seconds: number) => void): void {
    if (!this.socket?.writable) return

    // Observer registrieren
    this._send({ command: ['observe_property', 1, 'time-pos'] })

    this.socket.on('data', (chunk: Buffer) => {
      this.buf += chunk.toString()
      const lines = this.buf.split('\n')
      this.buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as {
            event?: string
            name?: string
            data?: unknown
          }
          if (
            msg.event === 'property-change' &&
            msg.name === 'time-pos' &&
            typeof msg.data === 'number'
          ) {
            cb(msg.data)
          }
        } catch {
          /* ignore malformed lines */
        }
      }
    })
  }

  quit(): void {
    if (this.socket?.writable) {
      try {
        this._send({ command: ['quit'] })
      } catch { /* ignore */ }
    }
    this.socket?.destroy()
    this.socket = null
  }

  disconnect(): void {
    this.socket?.destroy()
    this.socket = null
    this.buf = ''
  }

  private _send(msg: object): void {
    this.socket?.write(JSON.stringify(msg) + '\n')
  }
}
