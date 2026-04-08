/**
 * Gamepad-Service: pollt Gamepad-State via requestAnimationFrame und
 * dispatcht synthetische KeyboardEvents, sodass die Spatial-Navigation
 * ohne Gamepad-spezifischen Code in den Komponenten auskommt.
 *
 * Standard-Mapping (Xbox / Steam Deck):
 *   Button 12 = DPad Up    → ArrowUp
 *   Button 13 = DPad Down  → ArrowDown
 *   Button 14 = DPad Left  → ArrowLeft
 *   Button 15 = DPad Right → ArrowRight
 *   Button  0 = A          → Enter
 *   Button  1 = B          → Escape
 *   Axis  1 (left stick Y) → Up/Down
 *   Axis  0 (left stick X) → Left/Right
 */

interface ButtonState {
  pressed: boolean
  lastPressed: boolean
}

const BUTTON_MAP: Record<number, string> = {
  0: 'Enter',   // A
  1: 'Escape',  // B
  2: 'x',       // X
  3: 'y',       // Y
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight'
}

const AXIS_THRESHOLD = 0.5
const REPEAT_INITIAL_MS = 400
const REPEAT_INTERVAL_MS = 150

interface AxisRepeat {
  key: string | null
  heldSince: number
  lastRepeat: number
}

export class GamepadService {
  private rafId: number | null = null
  private buttonStates = new Map<number, ButtonState>()
  private axisRepeat: [AxisRepeat, AxisRepeat] = [
    { key: null, heldSince: 0, lastRepeat: 0 },
    { key: null, heldSince: 0, lastRepeat: 0 }
  ]

  start(): void {
    if (this.rafId !== null) return
    this.poll()
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private poll = (): void => {
    this.rafId = requestAnimationFrame(this.poll)
    const gamepads = navigator.getGamepads()
    const gp = gamepads[0] // erstes angeschlossenes Gamepad
    if (!gp) return

    const now = performance.now()

    // Buttons
    for (const [index, key] of Object.entries(BUTTON_MAP)) {
      const i = Number(index)
      const btn = gp.buttons[i]
      if (!btn) continue
      const prev = this.buttonStates.get(i) ?? { pressed: false, lastPressed: false }
      if (btn.pressed && !prev.pressed) {
        this.dispatch(key)
      }
      this.buttonStates.set(i, { pressed: btn.pressed, lastPressed: prev.pressed })
    }

    // Achsen (nur Axis 0 + 1 = linker Stick)
    const axisDefs: [number, string, string][] = [
      [0, 'ArrowLeft', 'ArrowRight'],
      [1, 'ArrowUp', 'ArrowDown']
    ]
    for (let a = 0; a < 2; a++) {
      const [axisIdx, negKey, posKey] = axisDefs[a]
      const val = gp.axes[axisIdx] ?? 0
      const state = this.axisRepeat[a]

      let activeKey: string | null = null
      if (val < -AXIS_THRESHOLD) activeKey = negKey
      else if (val > AXIS_THRESHOLD) activeKey = posKey

      if (activeKey !== state.key) {
        state.key = activeKey
        state.heldSince = now
        state.lastRepeat = 0
        if (activeKey) this.dispatch(activeKey)
      } else if (activeKey) {
        const held = now - state.heldSince
        if (held > REPEAT_INITIAL_MS) {
          if (state.lastRepeat === 0) state.lastRepeat = now
          if (now - state.lastRepeat > REPEAT_INTERVAL_MS) {
            this.dispatch(activeKey)
            state.lastRepeat = now
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
