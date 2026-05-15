/**
 * Liest Gamepad-Events via Linux evdev (/dev/input/event*).
 *
 * Erkennt Controller über /dev/input/js* und öffnet deren zugehöriges
 * event*-Interface. Das evdev-Interface liefert standardisierte, benannte
 * Button-Codes (BTN_SOUTH, BTN_NORTH, …) die über alle Controller-Typen
 * (Xbox, PlayStation, Nintendo) und Verbindungsarten (USB, Bluetooth)
 * konsistent sind – unabhängig davon, welchen Treiber der Kernel nutzt.
 *
 * Damit entfällt das alte Problem mit der button-Nummerierung im Joystick-API,
 * bei dem Xbox-One-Controller via Bluetooth (Share-Button verschiebt die
 * Nummerierung) X-Button als Nummer 3 statt 2 lieferten.
 *
 * Unterstützt mehrere Gamepads gleichzeitig (Steam Deck + Bluetooth Xbox).
 * Hotplug wird durch periodisches Scannen von /dev/input/ abgedeckt.
 *
 * BTN_*-Codes sind konsistent für alle Controller:
 *   BTN_SOUTH (0x130) = A / Cross
 *   BTN_EAST  (0x131) = B / Circle
 *   BTN_NORTH (0x133) = X / Square
 *   BTN_WEST  (0x134) = Y / Triangle
 *   BTN_TL    (0x136) = LB / L1
 *   BTN_TR    (0x137) = RB / R1
 *   BTN_TL2   (0x138) = LT / L2 (als Button bei manchen Controllern)
 *   BTN_TR2   (0x139) = RT / R2 (als Button bei manchen Controllern)
 *   ABS_HAT0X (16)    = D-Pad X-Achse
 *   ABS_HAT0Y (17)    = D-Pad Y-Achse
 *   ABS_X/Y   (0/1)   = Linker Stick
 *   ABS_Z/RZ  (2/5)   = LT/RT als Analog-Achse
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BrowserWindow } from 'electron'
import { DEDUP_WINDOW_MS, HOTPLUG_SCAN_INTERVAL_MS, TRIGGER_THRESHOLD } from '../constants/input'

// evdev input_event auf 64-bit Linux:
// { u64 tv_sec (8 Bytes), u64 tv_usec (8 Bytes), u16 type (2), u16 code (2), s32 value (4) } = 24 Bytes
const INPUT_EVENT_SIZE = 24

const EV_KEY = 0x01
const EV_ABS = 0x03

// Button codes (BTN_GAMEPAD range) — consistent across all controllers and drivers
const BTN_SOUTH = 0x130
const BTN_EAST  = 0x131
const BTN_NORTH = 0x133
const BTN_WEST  = 0x134
const BTN_TL    = 0x136
const BTN_TR    = 0x137
const BTN_TL2   = 0x138
const BTN_TR2   = 0x139

// ABS-Achsen-Codes
const ABS_X     = 0
const ABS_Y     = 1
const ABS_Z     = 2   // LT / L2
const ABS_RZ    = 5   // RT / R2
const ABS_HAT0X = 16  // D-Pad X
const ABS_HAT0Y = 17  // D-Pad Y

const BUTTON_MAP: Record<number, string> = {
  [BTN_SOUTH]: 'Enter',
  [BTN_EAST]:  'Escape',
  [BTN_NORTH]: 'x',
  [BTN_WEST]:  'y',
  [BTN_TL]:    'l1',
  [BTN_TR]:    'r1',
  [BTN_TL2]:   'l2',
  [BTN_TR2]:   'r2',
}

const STICK_THRESHOLD = 16384  // ~50% of 32767
const REPEAT_INITIAL_MS = 400
const REPEAT_INTERVAL_MS = 150
// Trigger axes must not fire auto-repeat (avoid repeating 300 s jumps)
const NO_REPEAT_ABS_CODES = new Set([ABS_Z, ABS_RZ])

interface AxisState {
  key: string | null
  timer: ReturnType<typeof setTimeout> | null
  interval: ReturnType<typeof setInterval> | null
}

/**
 * Sucht das zugehörige evdev-Device (/dev/input/eventN) für ein
 * Joystick-Device (/dev/input/jsN) über den /sys-Dateisystem-Pfad.
 */
function findEventDevice(jsDevicePath: string): string | null {
  try {
    const jsName = path.basename(jsDevicePath)             // 'js0'
    const sysLink = `/sys/class/input/${jsName}`
    const realPath = fs.realpathSync(sysLink)              // .../input/input7/js0
    const inputDir = path.dirname(realPath)                 // .../input/input7
    const entries = fs.readdirSync(inputDir)
    const eventEntry = entries.find((e) => /^event\d+$/.test(e))
    if (eventEntry) return `/dev/input/${eventEntry}`
  } catch {
    // No /sys access or device has disappeared
  }
  return null
}

class EvdevReader {
  private stream: fs.ReadStream | null = null
  private buf = Buffer.alloc(0)
  private axes = new Map<number, AxisState>()
  private alive = true

  constructor(
    readonly eventPath: string,
    private onKey: (key: string) => void
  ) {}

  start(): boolean {
    try {
      this.stream = fs.createReadStream(this.eventPath)
      this.stream.on('data', (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        this.buf = Buffer.concat([this.buf, buf])
        while (this.buf.length >= INPUT_EVENT_SIZE) {
          this.processEvent(this.buf.subarray(0, INPUT_EVENT_SIZE))
          this.buf = this.buf.subarray(INPUT_EVENT_SIZE)
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
    // Offsets in 24-Byte input_event: type @ 16, code @ 18, value @ 20
    const type  = raw.readUInt16LE(16)
    const code  = raw.readUInt16LE(18)
    const value = raw.readInt32LE(20)

    if (type === EV_KEY) {
      if (value === 1) {
        const key = BUTTON_MAP[code]
        if (key) this.onKey(key)
      }
    } else if (type === EV_ABS) {
      this.processAxis(code, value)
    }
  }

  private processAxis(code: number, value: number): void {
    let key: string | null = null

    if (code === ABS_HAT0X) {
      if (value < 0)      key = 'ArrowLeft'
      else if (value > 0) key = 'ArrowRight'
    } else if (code === ABS_HAT0Y) {
      if (value < 0)      key = 'ArrowUp'
      else if (value > 0) key = 'ArrowDown'
    } else if (code === ABS_X) {
      if (value < -STICK_THRESHOLD)     key = 'ArrowLeft'
      else if (value > STICK_THRESHOLD) key = 'ArrowRight'
    } else if (code === ABS_Y) {
      if (value < -STICK_THRESHOLD)     key = 'ArrowUp'
      else if (value > STICK_THRESHOLD) key = 'ArrowDown'
    } else if (code === ABS_Z) {
      if (value > TRIGGER_THRESHOLD) key = 'l2'
    } else if (code === ABS_RZ) {
      if (value > TRIGGER_THRESHOLD) key = 'r2'
    } else {
      return
    }

    let state = this.axes.get(code)
    if (!state) {
      state = { key: null, timer: null, interval: null }
      this.axes.set(code, state)
    }

    if (key !== state.key) {
      if (state.timer)    clearTimeout(state.timer)
      if (state.interval) clearInterval(state.interval)
      state.timer    = null
      state.interval = null
      state.key      = key

      if (key) {
        this.onKey(key)
        if (!NO_REPEAT_ABS_CODES.has(code)) {
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
 * Fallback-Reader für den Fall, dass kein evdev-Device gefunden wird.
 * Nutzt das alte Joystick-API (8-Byte-Events, Joystick-Nummern-Mapping).
 * Deckt Controller ab, die kein /sys-Event-Device-Mapping haben.
 */
class JoystickFallbackReader {
  private stream: fs.ReadStream | null = null
  private buf = Buffer.alloc(0)
  private axes = new Map<number, AxisState>()
  private alive = true

  private static readonly BUTTON_MAP: Record<number, string> = {
    0: 'Enter',
    1: 'Escape',
    2: 'x',
    3: 'y',
    4: 'l1',
    5: 'r1',
  }

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
      this.stream.on('error', () => { this.alive = false; this.stop() })
      this.stream.on('close', () => { this.alive = false })
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

  isAlive(): boolean { return this.alive }

  private processEvent(raw: Buffer): void {
    const value   = raw.readInt16LE(4)
    const rawType = raw.readUInt8(6)
    const number  = raw.readUInt8(7)
    const isInit  = (rawType & 0x80) !== 0
    const type    = rawType & ~0x80

    if (type === 0x01 && !isInit) {
      if (value === 1) {
        const key = JoystickFallbackReader.BUTTON_MAP[number]
        if (key) this.onKey(key)
      }
    } else if (type === 0x02) {
      this.processAxis(number, value, isInit)
    }
  }

  private processAxis(axis: number, value: number, isInit: boolean): void {
    let key: string | null = null
    if (axis === 6) {
      if (value < 0) key = 'ArrowLeft'
      else if (value > 0) key = 'ArrowRight'
    } else if (axis === 7) {
      if (value < 0) key = 'ArrowUp'
      else if (value > 0) key = 'ArrowDown'
    } else if (axis === 0) {
      if (value < -STICK_THRESHOLD)     key = 'ArrowLeft'
      else if (value > STICK_THRESHOLD) key = 'ArrowRight'
    } else if (axis === 1) {
      if (value < -STICK_THRESHOLD)     key = 'ArrowUp'
      else if (value > STICK_THRESHOLD) key = 'ArrowDown'
    } else if (axis === 2) {
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
      if (state.timer)    clearTimeout(state.timer)
      if (state.interval) clearInterval(state.interval)
      state.timer    = null
      state.interval = null
      state.key      = key

      if (key && !isInit) {
        this.onKey(key)
        if (axis !== 2 && axis !== 5) {
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
 * Startet das Lesen aller /dev/input/js* Devices (evdev-Interface bevorzugt).
 * Gibt eine Cleanup-Funktion zurück.
 */
export function startGamepadReader(getWindow: () => BrowserWindow | null): () => void {
  if (process.platform !== 'linux') return () => {}

  // Keyed by js-Device-Pfad
  const readers = new Map<string, EvdevReader | JoystickFallbackReader>()
  const lastKeyAt = new Map<string, number>()

  const onKey = (key: string): void => {
    const now = Date.now()
    const lastAt = lastKeyAt.get(key) ?? 0
    if (now - lastAt < DEDUP_WINDOW_MS) return
    lastKeyAt.set(key, now)

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
        const jsPath = path.join(inputDir, entry)
        seen.add(jsPath)

        if (readers.has(jsPath)) {
          if (!readers.get(jsPath)!.isAlive()) {
            readers.get(jsPath)!.stop()
            readers.delete(jsPath)
          } else {
            continue
          }
        }

        const eventPath = findEventDevice(jsPath)
        let reader: EvdevReader | JoystickFallbackReader

        if (eventPath) {
          reader = new EvdevReader(eventPath, onKey)
          if (reader.start()) {
            readers.set(jsPath, reader)
            console.log(`[gamepad] geöffnet (evdev): ${jsPath} → ${eventPath}`)
          }
        } else {
          // Fallback to legacy joystick API when no /sys mapping is found
          reader = new JoystickFallbackReader(jsPath, onKey)
          if (reader.start()) {
            readers.set(jsPath, reader)
            console.log(`[gamepad] geöffnet (js-fallback): ${jsPath}`)
          }
        }
      }

      for (const [jsPath, reader] of readers) {
        if (!seen.has(jsPath)) {
          console.log(`[gamepad] getrennt: ${jsPath}`)
          reader.stop()
          readers.delete(jsPath)
        }
      }
    } catch {
      // /dev/input not accessible
    }
  }

  scanDevices()
  const timer = setInterval(scanDevices, HOTPLUG_SCAN_INTERVAL_MS)

  return () => {
    clearInterval(timer)
    for (const reader of readers.values()) reader.stop()
    readers.clear()
  }
}
