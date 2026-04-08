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
        sock.on('error', () => {
          /* ignore socket errors after connect */
        })
        resolve()
      })
      sock.once('error', reject)
    })
  }

  quit(): void {
    if (this.socket?.writable) {
      try {
        this.socket.write(JSON.stringify({ command: ['quit'] }) + '\n')
      } catch {
        /* ignore */
      }
    }
    this.socket?.destroy()
    this.socket = null
  }

  disconnect(): void {
    this.socket?.destroy()
    this.socket = null
  }
}
