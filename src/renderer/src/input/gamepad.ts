/**
 * Gamepad-Service: pollt Gamepad-State via requestAnimationFrame und
 * dispatcht synthetische KeyboardEvents, sodass die Spatial-Navigation
 * ohne Gamepad-spezifischen Code in den Komponenten auskommt.
 *
 * Unterstützt mehrere Gamepads gleichzeitig (z.B. Steam Deck + Xbox BT).
 *
 * Standard-Mapping (Xbox / Steam Deck):
 *   Button 12 = DPad Up    → ArrowUp
 *   Button 13 = DPad Down  → ArrowDown
 *   Button 14 = DPad Left  → ArrowLeft
 *   Button 15 = DPad Right → ArrowRight
 *   Button  0 = A          → Enter
 *   Button  1 = B          → Escape
 *   Button  2 = X          → x
 *   Button  3 = Y          → y
 *   Button  4 = LB         → l1
 *   Button  5 = RB         → r1
 *   Axis  1 (left stick Y) → Up/Down
 *   Axis  0 (left stick X) → Left/Right
 */

import { AXIS_THRESHOLD, REPEAT_INITIAL_MS, REPEAT_INTERVAL_MS } from '../constants/input'

const BUTTON_MAP: Record<number, string> = {
  0: 'Enter',   // A
  1: 'Escape',  // B
  2: 'x',       // X
  3: 'y',       // Y
  4: 'l1',      // LB / L1
  5: 'r1',      // RB / R1
  6: 'l2',      // LT / L2
  7: 'r2',      // RT / R2
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight'
}

interface AxisRepeat {
  key: string | null
  heldSince: number
  lastRepeat: number
}

interface PadState {
  buttons: Map<number, boolean>
  axes: [AxisRepeat, AxisRepeat]
}

export class GamepadService {
  private rafId: number | null = null
  private padStates = new Map<number, PadState>()

  start(): void {
    if (this.rafId !== null) return
    window.addEventListener('gamepadconnected', this.onConnected)
    window.addEventListener('gamepaddisconnected', this.onDisconnected)
    this.poll()
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    window.removeEventListener('gamepadconnected', this.onConnected)
    window.removeEventListener('gamepaddisconnected', this.onDisconnected)
    this.padStates.clear()
  }

  private onConnected = (e: GamepadEvent): void => {
    console.log(`[gamepad] connected: ${e.gamepad.id} (index ${e.gamepad.index})`)
  }

  private onDisconnected = (e: GamepadEvent): void => {
    console.log(`[gamepad] disconnected: ${e.gamepad.id} (index ${e.gamepad.index})`)
    this.padStates.delete(e.gamepad.index)
  }

  private getState(index: number): PadState {
    let state = this.padStates.get(index)
    if (!state) {
      state = {
        buttons: new Map(),
        axes: [
          { key: null, heldSince: 0, lastRepeat: 0 },
          { key: null, heldSince: 0, lastRepeat: 0 }
        ]
      }
      this.padStates.set(index, state)
    }
    return state
  }

  private poll = (): void => {
    this.rafId = requestAnimationFrame(this.poll)
    const gamepads = navigator.getGamepads()
    const now = performance.now()

    for (const gp of gamepads) {
      if (!gp) continue
      this.processPad(gp, now)
    }
  }

  private processPad(gp: Gamepad, now: number): void {
    const state = this.getState(gp.index)

    // Buttons
    for (const [index, key] of Object.entries(BUTTON_MAP)) {
      const i = Number(index)
      const btn = gp.buttons[i]
      if (!btn) continue
      const wasPressed = state.buttons.get(i) ?? false
      if (btn.pressed && !wasPressed) {
        this.dispatch(key)
      }
      state.buttons.set(i, btn.pressed)
    }

    // Axes (0 = left stick X, 1 = left stick Y)
    const axisDefs: [number, string, string][] = [
      [0, 'ArrowLeft', 'ArrowRight'],
      [1, 'ArrowUp', 'ArrowDown']
    ]
    for (let a = 0; a < 2; a++) {
      const [axisIdx, negKey, posKey] = axisDefs[a]
      const val = gp.axes[axisIdx] ?? 0
      const ar = state.axes[a]

      let activeKey: string | null = null
      if (val < -AXIS_THRESHOLD) activeKey = negKey
      else if (val > AXIS_THRESHOLD) activeKey = posKey

      if (activeKey !== ar.key) {
        ar.key = activeKey
        ar.heldSince = now
        ar.lastRepeat = 0
        if (activeKey) this.dispatch(activeKey)
      } else if (activeKey) {
        const held = now - ar.heldSince
        if (held > REPEAT_INITIAL_MS) {
          if (ar.lastRepeat === 0) ar.lastRepeat = now
          if (now - ar.lastRepeat > REPEAT_INTERVAL_MS) {
            this.dispatch(activeKey)
            ar.lastRepeat = now
          }
        }
      }
    }
  }

  private dispatch(key: string): void {
    const target = document.activeElement ?? document.body
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }
}

export const gamepadService = new GamepadService()
