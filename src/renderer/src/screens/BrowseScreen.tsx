import { useCallback, useEffect, useRef, useState } from 'react'
import { GamepadHintItem } from '../components/GamepadPrompt'
import LanguageBadge from '../components/LanguageBadge'
import type { FollowedChannelInfo, GameInfo } from '../types/t4sd'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
  onSelectChannel: (ch: FollowedChannelInfo) => void
  onSelectCategory: (game: GameInfo) => void
}

type LoadState = 'loading' | 'ok' | 'error'
type FocusRegion = 'shelf' | 'grid'

const STREAM_W = 220
const STREAM_GAP = 14

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Mio.`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function formatViewersFull(n: number): string {
  return n.toLocaleString('de-DE')
}

export default function BrowseScreen({
  hasFocus,
  onRequestSidebar,
  onSelectChannel,
  onSelectCategory
}: Props): JSX.Element {
  const [topStreams, setTopStreams] = useState<FollowedChannelInfo[]>([])
  const [topGames, setTopGames] = useState<GameInfo[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [focusRegion, setFocusRegion] = useState<FocusRegion>('shelf')
  const [shelfIndex, setShelfIndex] = useState(0)
  const [gridIndex, setGridIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    setNextCursor(undefined)
    try {
      const [streams, gamesResult] = await Promise.all([
        window.t4sd.twitch.getTopStreams(),
        window.t4sd.twitch.getTopGames()
      ])
      setTopStreams(streams.streams)
      setTopGames(gamesResult.games)
      setNextCursor(gamesResult.cursor)
      setShelfIndex(0)
      setGridIndex(0)
      setFocusRegion('shelf')
      setLoadState('ok')
    } catch (err) {
      console.error('[BrowseScreen] Laden fehlgeschlagen:', err)
      setLoadState('error')
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const result = await window.t4sd.twitch.getTopGames(nextCursor)
      setTopGames((prev) => [...prev, ...result.games])
      setNextCursor(result.cursor)
    } catch (err) {
      console.error('[BrowseScreen] Nachladen fehlgeschlagen:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [nextCursor, isLoadingMore])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return window.t4sd.playback.onEvent((ev) => {
      if (ev.kind === 'started') setIsPlaying(true)
      else if (ev.kind === 'stopped' || ev.kind === 'error') setIsPlaying(false)
    })
  }, [])

  // Nächste Seite automatisch nachladen wenn letztes Element fokussiert wird
  useEffect(() => {
    if (focusRegion !== 'grid' || loadState !== 'ok') return
    if (gridIndex === topGames.length - 1 && nextCursor && !isLoadingMore) {
      void loadMore()
    }
  }, [gridIndex, focusRegion, loadState, topGames.length, nextCursor, isLoadingMore, loadMore])

  const getGridColumns = useCallback((): number => {
    const grid = gridRef.current
    if (!grid) return 5
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
    return Math.max(1, cols)
  }, [])

  useEffect(() => {
    if (!hasFocus) return

    const onKey = (e: KeyboardEvent): void => {
      // Während der Wiedergabe: nur Stop erlauben, Navigation blockieren
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

      if (loadState !== 'ok') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onRequestSidebar() }
        return
      }

      if (focusRegion === 'shelf') {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            if (shelfIndex === 0) onRequestSidebar()
            else setShelfIndex((i) => i - 1)
            break
          case 'ArrowRight':
            e.preventDefault()
            setShelfIndex((i) => Math.min(topStreams.length - 1, i + 1))
            break
          case 'ArrowDown':
            e.preventDefault()
            if (topGames.length > 0) setFocusRegion('grid')
            break
          case 'Enter': {
            e.preventDefault()
            const ch = topStreams[shelfIndex]
            if (ch) void window.t4sd.playback.startLive(ch.broadcasterLogin)
            break
          }
          case 'x':
          case 'X': {
            e.preventDefault()
            const ch = topStreams[shelfIndex]
            if (ch) onSelectChannel(ch)
            break
          }
          case 'Escape':
            e.preventDefault()
            onRequestSidebar()
            break
        }
      } else {
        // grid region
        const cols = getGridColumns()
        const total = topGames.length
        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault()
            setGridIndex((i) => Math.min(i + 1, total - 1))
            break
          case 'ArrowLeft':
            e.preventDefault()
            if (gridIndex % cols === 0) onRequestSidebar()
            else setGridIndex((i) => i - 1)
            break
          case 'ArrowDown':
            e.preventDefault()
            setGridIndex((i) => Math.min(i + cols, total - 1))
            break
          case 'ArrowUp':
            e.preventDefault()
            if (gridIndex < cols) {
              setFocusRegion('shelf')
            } else {
              setGridIndex((i) => i - cols)
            }
            break
          case 'Enter': {
            e.preventDefault()
            const game = topGames[gridIndex]
            if (game) onSelectCategory(game)
            break
          }
          case 'Escape':
            e.preventDefault()
            onRequestSidebar()
            break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, loadState, focusRegion, shelfIndex, gridIndex, topStreams, topGames, getGridColumns, onRequestSidebar, onSelectChannel, onSelectCategory, load, isPlaying])

  // Grid-Karte in den Viewport scrollen wenn fokussiert
  useEffect(() => {
    if (focusRegion !== 'grid') return
    const grid = gridRef.current
    if (!grid) return
    const card = grid.children[gridIndex] as HTMLElement | undefined
    card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [gridIndex, focusRegion])

  const shelfOffset = shelfIndex * (STREAM_W + STREAM_GAP)

  return (
    <div className="browse-screen">
      <header className="browse-screen__header">
        <h2 className="screen__title">Durchsuchen</h2>
        {loadState === 'ok' && (
          <div className="screen__meta">
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
          <p>Lade…</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="screen__state">
          <p>Fehler beim Laden.</p>
          <button className="btn" onClick={() => void load()}>
            Erneut versuchen
          </button>
        </div>
      )}

      {loadState === 'ok' && (
        <>
          {/* Top Live-Streams Shelf */}
          <div className="browse-shelf">
            <h3 className="browse-section__title">
              Top Live-Streams
              {focusRegion === 'shelf' && (
                <span className="browse-section__hint gamepad-hint-line">
                  <span className="gamepad-hint-separator">·</span>
                  <GamepadHintItem prompt="a">Live</GamepadHintItem>
                  <span className="gamepad-hint-separator">·</span>
                  <GamepadHintItem prompt="x">Kanalseite</GamepadHintItem>
                  <span className="gamepad-hint-separator">·</span>
                  <GamepadHintItem prompt="dpad-down">Kategorien</GamepadHintItem>
                </span>
              )}
            </h3>
            <div className="browse-shelf__viewport">
              <div
                className="browse-shelf__track"
                style={{ transform: `translateX(-${shelfOffset}px)` }}
              >
                {topStreams.map((ch, i) => (
                  <button
                    key={ch.broadcasterId}
                    className={`browse-stream-card${focusRegion === 'shelf' && shelfIndex === i ? ' browse-stream-card--focused' : ''}`}
                    onClick={() => void window.t4sd.playback.startLive(ch.broadcasterLogin)}
                    tabIndex={-1}
                  >
                    <div className="browse-stream-card__thumb">
                      {ch.thumbnailUrl && <img src={ch.thumbnailUrl} alt="" draggable={false} />}
                      <span className="card__live-badge">LIVE</span>
                      {ch.viewerCount !== undefined && (
                        <span className="card__viewers">{formatViewers(ch.viewerCount)}</span>
                      )}
                      <LanguageBadge language={ch.language} className="browse-stream-card__language" />
                    </div>
                    <span className="browse-stream-card__name">{ch.broadcasterName}</span>
                    {ch.gameName && (
                      <span className="browse-stream-card__game">{ch.gameName}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kategorien Grid */}
          <div className="browse-games">
            <h3 className="browse-section__title">
              Kategorien
              {focusRegion === 'grid' && (
                <span className="browse-section__hint gamepad-hint-line">
                  <span className="gamepad-hint-separator">·</span>
                  <GamepadHintItem prompt="a">Öffnen</GamepadHintItem>
                  <span className="gamepad-hint-separator">·</span>
                  <GamepadHintItem prompt="dpad-up">Zurück zu Streams</GamepadHintItem>
                </span>
              )}
            </h3>
            <div className="game-grid" ref={gridRef}>
              {topGames.map((game, i) => (
                <button
                  key={game.id}
                  className={`game-card${focusRegion === 'grid' && gridIndex === i ? ' game-card--focused' : ''}`}
                  onClick={() => onSelectCategory(game)}
                  tabIndex={-1}
                >
                  <div className="game-card__art">
                    <img src={game.boxArtUrl} alt="" draggable={false} />
                  </div>
                  <span className="game-card__name">{game.name}</span>
                  {game.viewerCount !== undefined && (
                    <span className="game-card__viewers">
                      {formatViewersFull(game.viewerCount)} Zuschauer
                    </span>
                  )}
                </button>
              ))}
              {isLoadingMore && (
                <div className="game-grid__loading-more">Lade weitere…</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
