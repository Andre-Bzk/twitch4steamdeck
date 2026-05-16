import { useCallback, useEffect, useRef, useState } from 'react'
import { GamepadHintItem } from '../components/GamepadPrompt'
import type { FollowedChannelInfo, GameInfo } from '../types/t4sd'
import FocusableCard from '../components/FocusableCard'
import log from 'electron-log/renderer'
import { useT } from '../i18n/useT'

interface Props {
  game: GameInfo
  onSelectChannel: (ch: FollowedChannelInfo) => void
  onStartLive: (ch: FollowedChannelInfo) => void
  onBack: () => void
}

type LoadState = 'loading' | 'ok' | 'error'

export default function CategoryScreen({ game, onSelectChannel, onStartLive, onBack }: Props): JSX.Element {
  const t = useT()
  const [streams, setStreams] = useState<FollowedChannelInfo[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const data = await window.t4sd.twitch.getTopStreams({ gameId: game.id, limit: 40 })
      setStreams(data.streams)
      setFocusedIndex(0)
      setLoadState('ok')
    } catch (err) {
      log.error('[CategoryScreen] Laden fehlgeschlagen:', err)
      setLoadState('error')
    }
  }, [game.id])

  useEffect(() => {
    void load()
  }, [load])

  const getColumns = useCallback((): number => {
    const grid = gridRef.current
    if (!grid) return 4
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
    return Math.max(1, cols)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'y' || e.key === 'Y') {
        void load()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
        return
      }

      if (loadState !== 'ok' || streams.length === 0) return

      const cols = getColumns()
      const total = streams.length

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(i + 1, total - 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (focusedIndex % cols === 0) onBack()
          else setFocusedIndex((i) => i - 1)
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
          if (ch) onStartLive(ch)
          break
        }
        case 'x':
        case 'X': {
          e.preventDefault()
          const ch = streams[focusedIndex]
          if (ch) onSelectChannel(ch)
          break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loadState, streams, focusedIndex, getColumns, onBack, onSelectChannel, onStartLive, load])

  return (
    <div className="category-screen">
      <header className="category-screen__header">
        <button className="btn category-screen__back" onClick={onBack}>
          ← {t('common.back')}
        </button>
        <img
          className="category-screen__art"
          src={game.boxArtUrl}
          alt=""
          draggable={false}
        />
        <div className="category-screen__info">
          <h2 className="category-screen__title">{game.name}</h2>
          {loadState === 'ok' && (
            <p className="category-screen__meta gamepad-hint-line">
              <span>{t('category.streamCount', { count: streams.length })}</span>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="y">{t('common.refresh')}</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="x">{t('common.channelPage')}</GamepadHintItem>
            </p>
          )}
        </div>
      </header>

      {loadState === 'loading' && (
        <div className="screen__state">
          <p>{t('category.loading')}</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="screen__state">
          <p>{t('category.loadError')}</p>
          <button className="btn" onClick={() => void load()}>
            {t('common.tryAgain')}
          </button>
        </div>
      )}

      {loadState === 'ok' && streams.length === 0 && (
        <div className="screen__state">
          <p>{t('category.empty')}</p>
        </div>
      )}

      {loadState === 'ok' && streams.length > 0 && (
        <div className="card-grid" ref={gridRef}>
          {streams.map((ch, i) => (
            <FocusableCard
              key={ch.broadcasterId}
              channel={ch}
              focused={i === focusedIndex}
              onFocus={() => setFocusedIndex(i)}
              onSelect={() => onStartLive(ch)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
