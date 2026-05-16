import { useEffect, useRef } from 'react'
import { dispatchPlaybackKey, dispatchQualityPanelKey } from '../lib/playbackKeys'
import type { PlaybackBindings, QualityPanelBindings } from '../lib/playbackKeys'

// ChannelScreen operates in one of five mutually exclusive input modes.
// Mode priority from highest to lowest: chapter > playback-quality > playback > hero > shelf.
export type ChannelMode = 'chapter' | 'playback-quality' | 'playback' | 'hero' | 'shelf'

// ─── Per-mode binding interfaces ────────────────────────────────────────────

export interface ChapterModeBindings {
  onClose: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  /** Caller handles the full select logic: seek-to (during playback) or start VOD. */
  onSelect: () => void
  /** Seek to start of VOD and close panel. Only provided when applicable
   *  (during playback with no chapters loaded). */
  onSeekToStart?: () => void
}

export interface ChannelPlaybackBindings extends PlaybackBindings {
  onOpenChapters: () => void
  onJumpChapter: (direction: 1 | -1) => void
}

export interface HeroModeBindings {
  isLive: boolean
  hasVods: boolean
  onPlayLive: () => void
  onFocusShelf: () => void
  onBack: () => void
}

export interface ShelfModeBindings {
  onPlayVod: () => void
  onOpenChapters: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onFocusHero: () => void
  onBack: () => void
}

interface Options {
  mode: ChannelMode
  chapter: ChapterModeBindings
  quality: QualityPanelBindings
  playback: ChannelPlaybackBindings
  hero: HeroModeBindings
  shelf: ShelfModeBindings
}

// ─── Per-mode handlers (pure functions) ─────────────────────────────────────

function handleChapterKey(e: KeyboardEvent, b: ChapterModeBindings): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    b.onClose()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    b.onMoveUp()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    b.onMoveDown()
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    b.onSelect()
  } else if (e.key === 'x' && b.onSeekToStart) {
    e.preventDefault()
    b.onSeekToStart()
  }
}

function handlePlaybackKey(e: KeyboardEvent, b: ChannelPlaybackBindings): void {
  if (dispatchPlaybackKey(e, b)) return
  // Channel-specific keys not covered by the common dispatcher
  switch (e.key) {
    case 'y':
      e.preventDefault()
      b.onOpenChapters()
      break
    case 'l1':
      e.preventDefault()
      b.onJumpChapter(-1)
      break
    case 'r1':
      e.preventDefault()
      b.onJumpChapter(1)
      break
    default:
      // Block all other keys from reaching screen navigation during playback
      e.preventDefault()
  }
}

function handleHeroKey(e: KeyboardEvent, b: HeroModeBindings): void {
  if (e.key === 'ArrowDown' && b.hasVods) {
    e.preventDefault()
    b.onFocusShelf()
  } else if ((e.key === 'Enter' || e.key === ' ') && b.isLive) {
    e.preventDefault()
    b.onPlayLive()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    b.onBack()
  }
}

function handleShelfKey(e: KeyboardEvent, b: ShelfModeBindings): void {
  switch (e.key) {
    case 'y':         e.preventDefault(); b.onOpenChapters(); break
    case 'ArrowLeft': e.preventDefault(); b.onMoveLeft();     break
    case 'ArrowRight':e.preventDefault(); b.onMoveRight();    break
    case 'ArrowUp':   e.preventDefault(); b.onFocusHero();    break
    case 'Enter':
    case ' ':         e.preventDefault(); b.onPlayVod();      break
    case 'Escape':    e.preventDefault(); b.onBack();         break
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Installs a single window keydown listener for ChannelScreen.
 * Dispatches each key to the handler matching the current mode.
 * Bindings are read from a ref so the listener never needs to be re-registered.
 */
export function useChannelKeyHandler(options: Options): void {
  const optionsRef = useRef(options)
  // Keep ref current synchronously so the listener always reads the latest state
  optionsRef.current = options

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const { mode, chapter, quality, playback, hero, shelf } = optionsRef.current
      if (mode === 'chapter')          { handleChapterKey(e, chapter);             return }
      if (mode === 'playback-quality') { dispatchQualityPanelKey(e, quality);       return }
      if (mode === 'playback')         { handlePlaybackKey(e, playback);            return }
      if (mode === 'hero')             { handleHeroKey(e, hero);                    return }
      if (mode === 'shelf')            { handleShelfKey(e, shelf);                  return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // stable — all state is accessed via optionsRef
}
