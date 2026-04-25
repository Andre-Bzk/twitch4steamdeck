import { useCallback, useEffect, useRef, useState } from 'react'
import FocusableCard from '../components/FocusableCard'
import { GamepadHintItem } from '../components/GamepadPrompt'
import type { FollowedChannelInfo } from '../types/t4sd'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
  onSelectChannel: (ch: FollowedChannelInfo) => void
}

type LoadState = 'loading' | 'ok' | 'error'

export default function FollowingScreen({
  hasFocus,
  onRequestSidebar,
  onSelectChannel
}: Props): JSX.Element {
  const [channels, setChannels] = useState<FollowedChannelInfo[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const data = await window.t4sd.twitch.getFollowed()
      setChannels(data)
      setFocusedIndex(0)
      setLoadState('ok')
    } catch (err) {
      console.error('[FollowingScreen] getFollowed fehlgeschlagen:', err)
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const getColumns = useCallback((): number => {
    const grid = gridRef.current
    if (!grid) return 4
    const style = getComputedStyle(grid)
    const cols = style.gridTemplateColumns.split(' ').filter(Boolean).length
    return Math.max(1, cols)
  }, [])

  useEffect(() => {
    if (!hasFocus) return

    const onKey = (e: KeyboardEvent): void => {
      // Refresh über [Y] funktioniert immer
      if (e.key === 'y' || e.key === 'Y') {
        void load()
        return
      }

      // Bei leeren / Fehler-Zuständen nur Left zum Sidebar zulassen
      if (loadState !== 'ok' || channels.length === 0) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          onRequestSidebar()
        }
        return
      }

      const cols = getColumns()
      const total = channels.length

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
          const ch = channels[focusedIndex]
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
  }, [hasFocus, loadState, channels, focusedIndex, getColumns, onRequestSidebar, load])

  const liveCount = channels.filter((c) => c.isLive).length

  return (
    <div className="screen screen--following">
      <header className="screen__header">
        <h2 className="screen__title">Du folgst</h2>
        {loadState === 'ok' && channels.length > 0 && (
          <div className="screen__meta">
            {liveCount > 0 && <span className="screen__live-count">● {liveCount} live</span>}
            <span>{channels.length} Kanäle</span>
            <span className="screen__hint gamepad-hint-line">
              <GamepadHintItem prompt="y">Aktualisieren</GamepadHintItem>
            </span>
          </div>
        )}
      </header>

      {loadState === 'loading' && (
        <div className="screen__state">
          <p>Lade Kanäle…</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="screen__state">
          <p>Fehler beim Laden der Kanäle.</p>
          <button className="btn" onClick={load}>
            Erneut versuchen
          </button>
        </div>
      )}

      {loadState === 'ok' && channels.length === 0 && (
        <div className="screen__state">
          <p>Du folgst noch keinen Kanälen.</p>
        </div>
      )}

      {loadState === 'ok' && channels.length > 0 && (
        <div className="card-grid card-grid--following" ref={gridRef}>
          {channels.map((ch, i) => (
            <FocusableCard
              key={ch.broadcasterId}
              channel={ch}
              focused={hasFocus && i === focusedIndex}
              onFocus={() => setFocusedIndex(i)}
              onSelect={() => onSelectChannel(ch)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
