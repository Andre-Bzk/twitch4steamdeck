import { useCallback, useEffect, useRef, useState } from 'react'
import FocusableCard from '../components/FocusableCard'
import { GamepadHintItem } from '../components/GamepadPrompt'
import type { FollowedChannelInfo } from '../types/t4sd'

interface Props {
  hasFocus: boolean
  title: string
  language: string
  onRequestSidebar: () => void
  onSelectChannel: (ch: FollowedChannelInfo) => void
}

type LoadState = 'loading' | 'ok' | 'error'

export default function StreamListScreen({
  hasFocus,
  title,
  language,
  onRequestSidebar,
  onSelectChannel
}: Props): JSX.Element {
  const [streams, setStreams] = useState<FollowedChannelInfo[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    setNextCursor(undefined)
    try {
      const result = await window.t4sd.twitch.getTopStreams({ language, limit: 20 })
      setStreams(result.streams)
      setNextCursor(result.cursor)
      setFocusedIndex(0)
      setLoadState('ok')
    } catch (err) {
      console.error('[StreamListScreen] Laden fehlgeschlagen:', err)
      setLoadState('error')
    }
  }, [language])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const result = await window.t4sd.twitch.getTopStreams({ language, limit: 20, cursor: nextCursor })
      setStreams((prev) => [...prev, ...result.streams])
      setNextCursor(result.cursor)
    } catch (err) {
      console.error('[StreamListScreen] Nachladen fehlgeschlagen:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [language, nextCursor, isLoadingMore])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return window.t4sd.playback.onEvent((ev) => {
      if (ev.kind === 'started') setIsPlaying(true)
      else if (ev.kind === 'stopped' || ev.kind === 'error') setIsPlaying(false)
    })
  }, [])

  useEffect(() => {
    if (loadState !== 'ok' || focusedIndex !== streams.length - 1 || !nextCursor || isLoadingMore) return
    void loadMore()
  }, [focusedIndex, streams.length, nextCursor, isLoadingMore, loadMore, loadState])

  const getColumns = useCallback((): number => {
    const grid = gridRef.current
    if (!grid) return 4
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
    return Math.max(1, cols)
  }, [])

  useEffect(() => {
    if (!hasFocus) return

    const onKey = (e: KeyboardEvent): void => {
      if (isPlaying) {
        e.preventDefault()
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          void window.t4sd.playback.stop()
        }
        return
      }

      if (e.key === 'y' || e.key === 'Y') {
        void load()
        return
      }

      if (loadState !== 'ok' || streams.length === 0) {
        if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          e.preventDefault()
          onRequestSidebar()
        }
        return
      }

      const cols = getColumns()
      const total = streams.length

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(i + 1, total - 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setFocusedIndex((i) => {
            if (i % cols === 0) {
              onRequestSidebar()
              return i
            }
            return i - 1
          })
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(i + cols, total - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(i - cols, 0))
          break
        case 'Enter': {
          e.preventDefault()
          const ch = streams[focusedIndex]
          if (ch) void window.t4sd.playback.startLive(ch.broadcasterLogin)
          break
        }
        case 'x':
        case 'X': {
          e.preventDefault()
          const ch = streams[focusedIndex]
          if (ch) onSelectChannel(ch)
          break
        }
        case 'Escape':
          e.preventDefault()
          onRequestSidebar()
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, isPlaying, load, loadState, streams, focusedIndex, getColumns, onRequestSidebar, onSelectChannel])

  return (
    <div className="screen screen--stream-list">
      <header className="screen__header">
        <h2 className="screen__title">{title}</h2>
        {loadState === 'ok' && streams.length > 0 && (
          <div className="screen__meta">
            <span>{streams.length} Streams</span>
            <span className="screen__hint gamepad-hint-line">
              <GamepadHintItem prompt="y">Aktualisieren</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="x">Kanalseite</GamepadHintItem>
            </span>
          </div>
        )}
      </header>

      {loadState === 'loading' && (
        <div className="screen__state">
          <p>Lade Streams…</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="screen__state">
          <p>Fehler beim Laden der Streams.</p>
          <button className="btn" onClick={() => void load()}>
            Erneut versuchen
          </button>
        </div>
      )}

      {loadState === 'ok' && streams.length === 0 && (
        <div className="screen__state">
          <p>Keine Live-Streams fuer diese Sprache gefunden.</p>
        </div>
      )}

      {loadState === 'ok' && streams.length > 0 && (
        <div className="card-grid card-grid--stream-list" ref={gridRef}>
          {streams.map((ch, i) => (
            <FocusableCard
              key={`${ch.broadcasterId}-${i}`}
              channel={ch}
              focused={hasFocus && i === focusedIndex}
              onFocus={() => setFocusedIndex(i)}
              onSelect={() => void window.t4sd.playback.startLive(ch.broadcasterLogin)}
            />
          ))}
          {isLoadingMore && (
            <div className="card-grid__loading-more">Lade weitere Streams…</div>
          )}
        </div>
      )}
    </div>
  )
}
