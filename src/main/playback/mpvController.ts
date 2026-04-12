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
  private nextRequestId = 1
  private pendingRequests = new Map<number, (value: unknown) => void>()
  private propertyObservers = new Map<string, Set<(value: unknown) => void>>()
  private eventObservers = new Map<string, Set<() => void>>()

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
        sock.on('data', (chunk: Buffer) => this.onData(chunk))
        resolve()
      })
      sock.once('error', reject)
    })
  }

  /** Beobachtet time-pos; ruft cb mit Sekunden auf. Throttling liegt beim Aufrufer. */
  observeTimePos(cb: (seconds: number) => void): void {
    if (!this.socket?.writable) return

    let observers = this.propertyObservers.get('time-pos')
    if (!observers) {
      observers = new Set()
      this.propertyObservers.set('time-pos', observers)
      this._send({ command: ['observe_property', 1, 'time-pos'] })
    }

    observers.add((value: unknown) => {
      if (typeof value === 'number') cb(value)
    })
  }

  pollTimePos(intervalMs: number, cb: (seconds: number) => void): () => void {
    const id = setInterval(async () => {
      const pos = await this.getTimePos()
      if (pos !== null) cb(pos)
    }, intervalMs)
    return () => clearInterval(id)
  }

  onEvent(eventName: string, cb: () => void): void {
    let observers = this.eventObservers.get(eventName)
    if (!observers) {
      observers = new Set()
      this.eventObservers.set(eventName, observers)
    }
    observers.add(cb)
  }

  seek(seconds: number): void {
    if (this.socket?.writable) {
      this._send({ command: ['seek', seconds, 'relative+keyframes'] })
    }
  }

  seekAbsolute(seconds: number): void {
    if (this.socket?.writable) {
      this._send({ command: ['seek', seconds, 'absolute+keyframes'] })
    }
  }

  /** Lädt eine URL neu (oder dieselbe) mit optionaler Startposition.
   *  Erzwingt komplette Demuxer-Neuinitialisierung — umgeht fMP4-Seek-Bug. */
  loadFile(url: string, startSeconds?: number): void {
    if (!this.socket?.writable) return
    if (startSeconds !== undefined && startSeconds > 0) {
      this._send({ command: ['loadfile', url, 'replace', '-1', `start=${startSeconds}`] })
    } else {
      this._send({ command: ['loadfile', url, 'replace'] })
    }
  }

  togglePause(): void {
    if (this.socket?.writable) {
      this._send({ command: ['cycle', 'pause'] })
    }
  }

  setPause(paused: boolean): void {
    if (this.socket?.writable) {
      this._send({ command: ['set_property', 'pause', paused] })
    }
  }

  getTimePos(): Promise<number | null> {
    return this.getProperty('time-pos').then((value) => (
      typeof value === 'number' ? value : null
    ))
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
    this.pendingRequests.clear()
    this.propertyObservers.clear()
    this.eventObservers.clear()
  }

  private _send(msg: object): void {
    this.socket?.write(JSON.stringify(msg) + '\n')
  }

  private getProperty(name: string): Promise<unknown> {
    if (!this.socket?.writable) return Promise.resolve(null)

    const requestId = this.nextRequestId++
    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve)
      this._send({ command: ['get_property', name], request_id: requestId })
    })
  }

  private onData(chunk: Buffer): void {
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
          request_id?: number
        }

        if (typeof msg.request_id === 'number') {
          const resolver = this.pendingRequests.get(msg.request_id)
          if (resolver) {
            this.pendingRequests.delete(msg.request_id)
            resolver(msg.data)
          }
        }

        if (msg.event === 'property-change' && typeof msg.name === 'string') {
          const observers = this.propertyObservers.get(msg.name)
          if (observers) {
            for (const observer of observers) observer(msg.data)
          }
        }

        if (typeof msg.event === 'string') {
          const observers = this.eventObservers.get(msg.event)
          if (observers) {
            for (const observer of observers) observer()
          }
        }
      } catch {
        /* ignore malformed lines */
      }
    }
  }
}
