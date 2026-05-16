import { useCallback, useEffect, useRef, useState } from 'react'
import FocusableCard from '../components/FocusableCard'
import { GamepadHintItem } from '../components/GamepadPrompt'
import type { FollowedChannelInfo } from '../types/t4sd'
import log from 'electron-log/renderer'
import { useT } from '../i18n/useT'

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
  const t = useT()
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
      log.error('[FollowingScreen] getFollowed fehlgeschlagen:', err)
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
      // [Y] refresh always works regardless of focus region
      if (e.key === 'y' || e.key === 'Y') {
        void load()
        return
      }

      // In empty / error states only allow Left to reach the sidebar
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
        <h2 className="screen__title">{t('nav.following')}</h2>
        {loadState === 'ok' && channels.length > 0 && (
          <div className="screen__meta">
            {liveCount > 0 && <span className="screen__live-count">{t('following.liveCount', { count: liveCount })}</span>}
            <span>{t('following.channelCount', { count: channels.length })}</span>
            <span className="screen__hint gamepad-hint-line">
              <GamepadHintItem prompt="y">{t('common.refresh')}</GamepadHintItem>
            </span>
          </div>
        )}
      </header>

      {loadState === 'loading' && (
        <div className="screen__state">
          <p>{t('following.loading')}</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="screen__state">
          <p>{t('following.loadError')}</p>
          <button className="btn" onClick={load}>
            {t('common.tryAgain')}
          </button>
        </div>
      )}

      {loadState === 'ok' && channels.length === 0 && (
        <div className="screen__state">
          <p>{t('following.empty')}</p>
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
