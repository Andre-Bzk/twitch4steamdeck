/**
 * Liest Gamepad-Events direkt von /dev/input/js* (Linux joystick API).
 * Umgeht Chromiums Gamepad API, die in Flatpak/Gaming Mode nicht funktioniert,
 * weil Steam Input den Controller virtualisiert und udev-Events nicht
 * in die Sandbox propagieren.
 *
 * Unterstützt mehrere Gamepads gleichzeitig (Steam Deck + Bluetooth Xbox).
 * Hotplug wird durch periodisches Scannen von /dev/input/ abgedeckt.
 *
 * Xbox 360 / Steam Virtual Controller Joystick-Mapping:
 *   Buttons: 0=A, 1=B, 2=X, 3=Y, 4=LB, 5=RB, 6=Back, 7=Start
 *   Axes:    0=LStickX, 1=LStickY, 2=LTrigger, 3=RStickX, 4=RStickY, 5=RTrigger, 6=DPadX, 7=DPadY
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BrowserWindow } from 'electron'

// js_event: { u32 time, s16 value, u8 type, u8 number } = 8 bytes
const JS_EVENT_BUTTON = 0x01
const JS_EVENT_AXIS = 0x02
const JS_EVENT_INIT = 0x80

const BUTTON_MAP: Record<number, string> = {
  0: 'Enter',   // A
  1: 'Escape',  // B
  2: 'x',       // X
  3: 'y',       // Y
  4: 'l1',      // LB / L1
  5: 'r1'       // RB / R1
}

const STICK_THRESHOLD = 16384 // ~50% von 32767
const REPEAT_INITIAL_MS = 400
const REPEAT_INTERVAL_MS = 150
// L2/R2 Trigger: kein Auto-Repeat, da 300s-Spruenge nicht wiederholt werden sollen.
const NO_REPEAT_AXES = new Set([2, 5])
const SCAN_INTERVAL_MS = 3000

interface AxisState {
  key: string | null
  timer: ReturnType<typeof setTimeout> | null
  interval: ReturnType<typeof setInterval> | null
}

class JoystickReader {
  private stream: fs.ReadStream | null = null
  private buf = Buffer.alloc(0)
  private axes = new Map<number, AxisState>()
  private alive = true

  constructor(
    readonly devicePath: string,
    private onKey: (key: string) => void
  ) {}

  start(): boolean {
    try {
      this.stream = fs.createReadStream(this.devicePath)
      this.stream.on('data', (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        this.buf = Buffer.concat([this.buf, buf])
        while (this.buf.length >= 8) {
          this.processEvent(this.buf.subarray(0, 8))
          this.buf = this.buf.subarray(8)
        }
      })
      this.stream.on('error', () => {
        this.alive = false
        this.stop()
      })
      this.stream.on('close', () => {
        this.alive = false
      })
      return true
    } catch {
      this.alive = false
      return false
    }
  }

  stop(): void {
    this.stream?.destroy()
    this.stream = null
    for (const state of this.axes.values()) {
      if (state.timer) clearTimeout(state.timer)
      if (state.interval) clearInterval(state.interval)
    }
    this.axes.clear()
  }

  isAlive(): boolean {
    return this.alive
  }

  private processEvent(raw: Buffer): void {
    const value = raw.readInt16LE(4)
    const rawType = raw.readUInt8(6)
    const number = raw.readUInt8(7)
    const isInit = (rawType & JS_EVENT_INIT) !== 0
    const type = rawType & ~JS_EVENT_INIT

    if (type === JS_EVENT_BUTTON && !isInit) {
      if (value === 1) {
        const key = BUTTON_MAP[number]
        if (key) this.onKey(key)
      }
    } else if (type === JS_EVENT_AXIS) {
      this.processAxis(number, value, isInit)
    }
  }

  private processAxis(axis: number, value: number, isInit: boolean): void {
    let key: string | null = null

    // D-Pad (Axes 6/7): binäre Werte (-32767, 0, 32767)
    if (axis === 6) {
      if (value < 0) key = 'ArrowLeft'
      else if (value > 0) key = 'ArrowRight'
    } else if (axis === 7) {
      if (value < 0) key = 'ArrowUp'
      else if (value > 0) key = 'ArrowDown'
    }
    // Left Stick (Axes 0/1): analoge Werte mit Deadzone
    else if (axis === 0) {
      if (value < -STICK_THRESHOLD) key = 'ArrowLeft'
      else if (value > STICK_THRESHOLD) key = 'ArrowRight'
    } else if (axis === 1) {
      if (value < -STICK_THRESHOLD) key = 'ArrowUp'
      else if (value > STICK_THRESHOLD) key = 'ArrowDown'
    }
    // Trigger (Axes 2/5): -32767 = nicht gedrückt, +32767 = voll gedrückt
    else if (axis === 2) {
      if (value > 0) key = 'l2'
    } else if (axis === 5) {
      if (value > 0) key = 'r2'
    } else {
      return
    }

    let state = this.axes.get(axis)
    if (!state) {
      state = { key: null, timer: null, interval: null }
      this.axes.set(axis, state)
    }

    if (key !== state.key) {
      if (state.timer) clearTimeout(state.timer)
      if (state.interval) clearInterval(state.interval)
      state.timer = null
      state.interval = null
      state.key = key

      if (key && !isInit) {
        this.onKey(key)
        if (!NO_REPEAT_AXES.has(axis)) {
          const k = key
          state.timer = setTimeout(() => {
            if (state!.key === k) {
              this.onKey(k)
              state!.interval = setInterval(() => {
                if (state!.key === k) this.onKey(k)
              }, REPEAT_INTERVAL_MS)
            }
          }, REPEAT_INITIAL_MS)
        }
      }
    }
  }
}

/**
 * Startet das Lesen aller /dev/input/js* Devices.
 * Gibt eine Cleanup-Funktion zurück.
 */
export function startGamepadReader(getWindow: () => BrowserWindow | null): () => void {
  if (process.platform !== 'linux') return () => {}

  const readers = new Map<string, JoystickReader>()

  const onKey = (key: string): void => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send('gamepad-input', key)
  }

  const scanDevices = (): void => {
    const inputDir = '/dev/input'
    try {
      const entries = fs.readdirSync(inputDir)
      const seen = new Set<string>()

      for (const entry of entries) {
        if (!entry.startsWith('js')) continue
        const devPath = path.join(inputDir, entry)
        seen.add(devPath)

        if (readers.has(devPath)) {
          if (!readers.get(devPath)!.isAlive()) {
            readers.get(devPath)!.stop()
            readers.delete(devPath)
          } else {
            continue
          }
        }

        const reader = new JoystickReader(devPath, onKey)
        if (reader.start()) {
          readers.set(devPath, reader)
          console.log(`[gamepad] geöffnet: ${devPath}`)
        }
      }

      // Entfernte Devices aufräumen
      for (const [devPath, reader] of readers) {
        if (!seen.has(devPath)) {
          console.log(`[gamepad] getrennt: ${devPath}`)
          reader.stop()
          readers.delete(devPath)
        }
      }
    } catch {
      // /dev/input nicht zugänglich
    }
  }

  scanDevices()
  const timer = setInterval(scanDevices, SCAN_INTERVAL_MS)

  return () => {
    clearInterval(timer)
    for (const reader of readers.values()) reader.stop()
    readers.clear()
  }
}
