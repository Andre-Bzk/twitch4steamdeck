// Common key-dispatch helpers used by both AppShell (global live overlay) and
// ChannelScreen (channel-bound playback). A single source of truth for which key
// does what during playback — prevents silent divergence between the two contexts.

export interface PlaybackBindings {
  onTogglePause: () => void
  onSeek: (seconds: number) => void
  onStop: () => void
  /** If undefined, the x-key is not handled (quality panel not available). */
  onOpenQuality?: () => void
}

export interface QualityPanelBindings {
  qualities: string[]
  focusedIndex: number
  /** Called with -1 for up, +1 for down. Caller is responsible for clamping the index. */
  onMoveFocus: (delta: -1 | 1) => void
  onApply: (quality: string) => void
  onClose: () => void
}

/**
 * Dispatch a keydown event against the common playback controls.
 * Returns true if the event was consumed (preventDefault already called).
 * Caller handles any remaining keys after this returns false.
 */
export function dispatchPlaybackKey(e: KeyboardEvent, b: PlaybackBindings): boolean {
  switch (e.key) {
    case 'l2':
      e.preventDefault()
      b.onSeek(-300)
      return true
    case 'r2':
      e.preventDefault()
      b.onSeek(300)
      return true
    case 'ArrowLeft':
      e.preventDefault()
      b.onSeek(-30)
      return true
    case 'ArrowRight':
      e.preventDefault()
      b.onSeek(30)
      return true
    case 'Enter':
    case ' ':
      e.preventDefault()
      b.onTogglePause()
      return true
    case 'Escape':
      e.preventDefault()
      b.onStop()
      return true
    case 'x':
      if (b.onOpenQuality) {
        e.preventDefault()
        b.onOpenQuality()
        return true
      }
      return false
    default:
      return false
  }
}

/**
 * Dispatch a keydown event against the quality-panel controls.
 * Returns true if the event was consumed (preventDefault already called).
 */
export function dispatchQualityPanelKey(e: KeyboardEvent, b: QualityPanelBindings): boolean {
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      b.onMoveFocus(-1)
      return true
    case 'ArrowDown':
      e.preventDefault()
      b.onMoveFocus(1)
      return true
    case 'Enter':
    case ' ': {
      e.preventDefault()
      const q = b.qualities[b.focusedIndex]
      if (q) b.onApply(q)
      return true
    }
    case 'Escape':
      e.preventDefault()
      b.onClose()
      return true
    default:
      return false
  }
}
