import { useEffect, useRef, useState } from 'react'
import { GamepadHintItem, GamepadPrompt } from '../components/GamepadPrompt'
import { PlaybackOverlay } from '../components/PlaybackOverlay'
import type { FollowedChannelInfo, PlaybackEvent, VodChapter, VodInfo, VodProgress } from '../types/t4sd'

interface Props {
  channel: FollowedChannelInfo
  onBack: () => void
}

type PlayState = 'idle' | 'starting' | 'playing' | 'paused' | 'error'
type FocusRegion = 'hero' | 'shelf' | 'chapters'

const CARD_W = 260
const CARD_GAP = 16

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Mio.`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatWatchedAt(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 2) return 'Gerade eben'
  if (mins < 60) return `Vor ${mins} Min.`
  if (hours < 24) return `Vor ${hours} Std.`
  if (days === 1) return 'Gestern'
  if (days < 7) return `Vor ${days} Tagen`
  return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function resolveThumbnail(url: string | undefined, w = 1280, h = 720): string | undefined {
  return url?.replace('{width}', String(w)).replace('{height}', String(h))
}

function formatTimestamp(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ChannelScreen({ channel, onBack }: Props): JSX.Element {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [vods, setVods] = useState<VodInfo[]>([])
  const [vodsLoading, setVodsLoading] = useState(true)
  const [progressMap, setProgressMap] = useState<Record<string, VodProgress>>({})
  const [focusRegion, setFocusRegion] = useState<FocusRegion>('hero')
  const [shelfIndex, setShelfIndex] = useState(0)
  const [chapterPanelVod, setChapterPanelVod] = useState<VodInfo | null>(null)
  const [chapters, setChapters] = useState<VodChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [wasPlayingBeforeChapters, setWasPlayingBeforeChapters] = useState(false)
  const [currentVod, setCurrentVod] = useState<VodInfo | null>(null)
  const [pendingChapterVod, setPendingChapterVod] = useState<VodInfo | null>(null)
  // Overlay state
  const [currentPosition, setCurrentPosition] = useState(0)
  const [vodDuration, setVodDuration] = useState(0)
  const [isLivePlayback, setIsLivePlayback] = useState(false)
  const watchBtnRef = useRef<HTMLButtonElement>(null)
  const chapterListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    window.t4sd.twitch
      .getVideos(channel.broadcasterId)
      .then((loaded) => {
        setVods(loaded)
        const ids = loaded.map((v) => v.id)
        return window.t4sd.history.getProgress(ids).then(setProgressMap)
      })
      .catch(() => {})
      .finally(() => setVodsLoading(false))
  }, [channel.broadcasterId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const isPlaying = playState === 'playing' || playState === 'starting' || playState === 'paused'

      // Kapitel-Panel hat oberste Priorität (gilt auch während Wiedergabe)
      if (focusRegion === 'chapters' && chapterPanelVod) {
        const duringPlayback = isPlaying
        if (e.key === 'Escape') {
          e.preventDefault()
          if (duringPlayback) {
            setChapterPanelVod(null)
            setFocusRegion('hero')
            if (wasPlayingBeforeChapters) {
              void window.t4sd.playback.resume()
              setPlayState('playing')
            }
          } else {
            setChapterPanelVod(null)
            setFocusRegion('shelf')
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          setChapterIndex((i) => Math.min(Math.max(0, chapters.length - 1), i + 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setChapterIndex((i) => Math.max(0, i - 1))
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const vod = chapterPanelVod
          if (!vod) return
          const chapter = chapters[chapterIndex]
          if (duringPlayback) {
            if (chapter) {
              void window.t4sd.playback.seekTo(chapter.positionSeconds)
              void window.t4sd.playback.resume()
              setPlayState('playing')
            } else {
              if (wasPlayingBeforeChapters) {
                void window.t4sd.playback.resume()
                setPlayState('playing')
              }
            }
            setChapterPanelVod(null)
            setFocusRegion('hero')
          } else {
            if (chapter) {
              void handleWatchVodFromChapter(vod, chapter.positionSeconds)
            } else {
              void handleWatchVod(vod)
              setChapterPanelVod(null)
            }
          }
        }
        return
      }

      // Während der Wiedergabe: nur Playback-Steuerung erlauben, keine Navigation
      if (isPlaying) {
        switch (e.key) {
          case 'l2':
            e.preventDefault()
            void window.t4sd.playback.seek(-300)
            break
          case 'r2':
            e.preventDefault()
            void window.t4sd.playback.seek(300)
            break
          case 'ArrowLeft':
            e.preventDefault()
            void window.t4sd.playback.seek(-30)
            break
          case 'ArrowRight':
            e.preventDefault()
            void window.t4sd.playback.seek(30)
            break
          case 'Enter':
          case ' ':
            e.preventDefault()
            if (playState === 'playing') {
              void window.t4sd.playback.togglePause()
              setPlayState('paused')
            } else if (playState === 'paused') {
              void window.t4sd.playback.togglePause()
              setPlayState('playing')
            }
            break
          case 'Escape':
            e.preventDefault()
            void window.t4sd.playback.stop()
            break
          case 'y': {
            e.preventDefault()
            const vod = currentVod ?? vods[shelfIndex]
            if (vod) openChapterPanel(vod, true)
            break
          }
          case 'l1':
            e.preventDefault()
            void jumpChapter(-1)
            break
          case 'r1':
            e.preventDefault()
            void jumpChapter(1)
            break
          default:
            e.preventDefault()
        }
        return
      }

      if (focusRegion === 'hero') {
        if (e.key === 'ArrowDown' && vods.length > 0) {
          e.preventDefault()
          setFocusRegion('shelf')
          setShelfIndex(0)
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (channel.isLive) {
            void handleWatch()
          }
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onBack()
        }
      } else {
        // shelf region
        if (e.key === 'y') {
          e.preventDefault()
          const vod = vods[shelfIndex]
          if (vod) openChapterPanel(vod, false)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setShelfIndex((i) => Math.max(0, i - 1))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setShelfIndex((i) => Math.min(vods.length - 1, i + 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setFocusRegion('hero')
          watchBtnRef.current?.focus()
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const vod = vods[shelfIndex]
          if (vod) void handleWatchVod(vod)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onBack()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusRegion, playState, vods, shelfIndex, onBack, chapters, chapterIndex, chapterPanelVod, wasPlayingBeforeChapters, currentVod])

  useEffect(() => {
    const unsub = window.t4sd.playback.onEvent((ev: PlaybackEvent) => {
      if (ev.kind === 'started') {
        setPlayState('playing')
        setVodDuration(ev.durationSeconds ?? 0)
        setIsLivePlayback(ev.isLive ?? false)
        setCurrentPosition(0)
      } else if (ev.kind === 'stopped') {
        const nextChapterVod = pendingChapterVod
        setPlayState('idle')
        setChapterPanelVod(null)
        setCurrentVod(null)
        // Progress nach Stop neu laden
        if (vods.length > 0) {
          void window.t4sd.history
            .getProgress(vods.map((v) => v.id))
            .then(setProgressMap)
            .catch(() => {})
        }
        if (nextChapterVod) {
          setPendingChapterVod(null)
          showChapterPanel(nextChapterVod)
        } else {
          setFocusRegion('shelf')
        }
      } else if (ev.kind === 'error') {
        setPlayState('error')
        setChapterPanelVod(null)
        setCurrentVod(null)
        setPendingChapterVod(null)
        setErrorMsg(ev.message ?? 'Unbekannter Fehler')
      }
    })
    return unsub
  }, [pendingChapterVod, vods])

  // Subscribe to ~1 Hz position updates from main process for the overlay seek bar
  useEffect(() => {
    if (playState !== 'playing' && playState !== 'paused') return
    const unsub = window.t4sd.playback.onTimeUpdate(({ positionSeconds }) => {
      setCurrentPosition(positionSeconds)
    })
    return unsub
  }, [playState])

  useEffect(() => {
    watchBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!chapterListRef.current) return
    const item = chapterListRef.current.children[chapterIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [chapterIndex])

  const loadChapters = async (vodId: string): Promise<VodChapter[]> => {
    return window.t4sd.twitch.getVodChapters(vodId)
  }

  const showChapterPanel = (vod: VodInfo): void => {
    setChapterPanelVod(vod)
    setChapters([])
    setChapterIndex(0)
    setChaptersLoading(true)
    setFocusRegion('chapters')
    setWasPlayingBeforeChapters(false)
    void loadChapters(vod.id)
      .then((loaded) => setChapters(loaded))
      .catch(() => {})
      .finally(() => setChaptersLoading(false))
  }

  const jumpChapter = async (direction: 1 | -1): Promise<void> => {
    if (!currentVod) return

    const [loadedChapters, currentPosition] = await Promise.all([
      loadChapters(currentVod.id),
      window.t4sd.playback.getCurrentPosition()
    ])
    if (loadedChapters.length === 0 || currentPosition === null) return

    const epsilon = 1
    const target = direction > 0
      ? loadedChapters.find((chapter) => chapter.positionSeconds > currentPosition + epsilon)
      : [...loadedChapters].reverse().find((chapter) => chapter.positionSeconds < currentPosition - epsilon)

    if (target) {
      await window.t4sd.playback.seekTo(target.positionSeconds)
    }
  }

  const handleWatch = async (): Promise<void> => {
    setPlayState('starting')
    setErrorMsg('')
    try {
      await window.t4sd.playback.startLive(channel.broadcasterLogin)
    } catch (e) {
      setPlayState('error')
      setErrorMsg(String(e))
    }
  }

  const handleWatchVod = async (vod: VodInfo): Promise<void> => {
    setPlayState('starting')
    setErrorMsg('')
    setFocusRegion('hero')
    setChapterPanelVod(null)
    setWasPlayingBeforeChapters(false)
    setCurrentVod(vod)
    setPendingChapterVod(null)
    try {
      await window.t4sd.playback.startVod(
        vod.id,
        channel.broadcasterLogin,
        vod.title,
        vod.durationSeconds
      )
    } catch (e) {
      setPlayState('error')
      setErrorMsg(String(e))
    }
  }

  const openChapterPanel = (vod: VodInfo, duringPlayback: boolean): void => {
    if (duringPlayback) {
      setPendingChapterVod(vod)
      void window.t4sd.playback.stop()
      return
    }
    showChapterPanel(vod)
  }

  const handleWatchVodFromChapter = async (vod: VodInfo, startSeconds: number): Promise<void> => {
    setPlayState('starting')
    setErrorMsg('')
    setFocusRegion('hero')
    setChapterPanelVod(null)
    setWasPlayingBeforeChapters(false)
    setCurrentVod(vod)
    setPendingChapterVod(null)
    try {
      await window.t4sd.playback.startVod(
        vod.id,
        channel.broadcasterLogin,
        vod.title,
        vod.durationSeconds,
        startSeconds
      )
    } catch (e) {
      setPlayState('error')
      setErrorMsg(String(e))
    }
  }

  const handleStop = async (): Promise<void> => {
    await window.t4sd.playback.stop()
  }

  const thumb = resolveThumbnail(channel.thumbnailUrl)
  const trackOffset = shelfIndex * (CARD_W + CARD_GAP)

  return (
    <div className="channel-screen">
      <button className="channel-screen__back btn" onClick={onBack} tabIndex={0}>
        ← Zurück
      </button>

      <div className="channel-screen__hero">
        <div className="channel-screen__thumb">
          {thumb ? (
            <img src={thumb} alt="" draggable={false} />
          ) : (
            <div className="channel-screen__thumb-placeholder">
              {channel.profileImageUrl && (
                <img src={channel.profileImageUrl} alt="" draggable={false} />
              )}
            </div>
          )}
          {channel.isLive && <span className="channel-screen__live-badge">LIVE</span>}
        </div>

        <div className="channel-screen__info">
          <div className="channel-screen__name-row">
            {channel.profileImageUrl && (
              <img
                className="channel-screen__avatar"
                src={channel.profileImageUrl}
                alt=""
                draggable={false}
              />
            )}
            <h2 className="channel-screen__name">{channel.broadcasterName}</h2>
          </div>

          {channel.streamTitle && (
            <p className="channel-screen__title">{channel.streamTitle}</p>
          )}
          {channel.gameName && (
            <p className="channel-screen__game">{channel.gameName}</p>
          )}
          {channel.viewerCount !== undefined && (
            <p className="channel-screen__viewers">
              {formatViewers(channel.viewerCount)} Zuschauer
            </p>
          )}

          <div className="channel-screen__actions">
            {(playState === 'idle' || playState === 'error') && channel.isLive && (
              <button
                ref={watchBtnRef}
                className="btn btn--primary"
                onClick={() => void handleWatch()}
              >
                ▶ Live ansehen
              </button>
            )}

            {(playState === 'idle' || playState === 'error') && !channel.isLive && (
              <button ref={watchBtnRef} className="btn btn--primary" disabled style={{ opacity: 0 }}>
                placeholder
              </button>
            )}

            {playState === 'starting' && (
              <button className="btn" disabled>
                Starte Wiedergabe…
              </button>
            )}

            {(playState === 'playing' || playState === 'paused') && (
              <span className="channel-screen__playing-hint">
                ● Wiedergabe{playState === 'paused' ? ' (Pause)' : ''}
              </span>
            )}

            {!channel.isLive && playState === 'idle' && (
              <p className="channel-screen__offline">Kanal ist gerade offline.</p>
            )}

            {playState === 'error' && (
              <p className="channel-screen__error" style={{ whiteSpace: 'pre-wrap', fontSize: '13px', maxHeight: '8em', overflowY: 'auto' }}>{errorMsg}</p>
            )}
          </div>
        </div>
      </div>

      <div className="channel-screen__vods">
        <h3 className="channel-screen__vods-title">
          Vergangene Streams
          {focusRegion === 'shelf' && (
            <span className="channel-screen__vods-hint gamepad-hint-line">
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="dpad-up">Zurück</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="a">Abspielen</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="y">Kapitel</GamepadHintItem>
            </span>
          )}
        </h3>
        {vodsLoading && <p className="channel-screen__vods-loading">Lade VODs…</p>}
        {!vodsLoading && vods.length === 0 && (
          <p className="channel-screen__vods-empty">Keine archivierten Streams verfügbar.</p>
        )}
        {vods.length > 0 && (
          <div className="channel-screen__shelf-viewport">
            <div
              className="channel-screen__shelf-track"
              style={{ transform: `translateX(-${trackOffset}px)` }}
            >
              {vods.map((vod, i) => {
                const prog = progressMap[vod.id]
                const pct =
                  prog && !prog.completed && vod.durationSeconds > 0
                    ? Math.min(100, (prog.resumePositionSeconds / vod.durationSeconds) * 100)
                    : 0
                return (
                  <div
                    key={vod.id}
                    className={`channel-screen__vod-card${focusRegion === 'shelf' && shelfIndex === i ? ' channel-screen__vod-card--focused' : ''}`}
                    onClick={() => void handleWatchVod(vod)}
                  >
                    <div className="channel-screen__vod-thumb">
                      {vod.thumbnailUrl && !vod.thumbnailUrl.includes('404_processing') ? (
                        <img src={vod.thumbnailUrl} alt="" draggable={false} />
                      ) : (
                        <div className="channel-screen__vod-thumb-placeholder" />
                      )}
                      <span className="channel-screen__vod-duration">
                        {prog && !prog.completed && prog.resumePositionSeconds > 0
                          ? `${formatDuration(prog.resumePositionSeconds)} von ${formatDuration(vod.durationSeconds)}`
                          : formatDuration(vod.durationSeconds)}
                      </span>
                      {pct > 0 && (
                        <div className="channel-screen__vod-progress">
                          <div
                            className="channel-screen__vod-progress-bar"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {prog?.completed && (
                        <div className="channel-screen__vod-completed">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="7 13 10.5 16.5 17 8" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="channel-screen__vod-title">{vod.title}</p>
                    <p className="channel-screen__vod-meta">
                      {formatDate(vod.createdAt)}
                      {prog && !prog.completed && (
                        <span className="channel-screen__vod-watched">
                          {' · '}{formatWatchedAt(prog.watchedAt)}
                        </span>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {chapterPanelVod && (
        <div className="chapter-overlay">
          <div className="chapter-overlay__panel">
            <div className="chapter-overlay__header">
              <span className="chapter-overlay__title">Kapitel wählen</span>
              <span className="chapter-overlay__vod-name">{chapterPanelVod.title}</span>
            </div>
            <p className="chapter-overlay__hint gamepad-hint-line">
              <GamepadHintItem prompt={['dpad-up', 'dpad-down']}>Navigieren</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="a">Öffnen</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="b">Schließen</GamepadHintItem>
            </p>
            {chaptersLoading && <p className="chapter-overlay__msg">Lade Kapitel…</p>}
            {!chaptersLoading && chapters.length === 0 && (
              <p className="chapter-overlay__msg">
                Keine Kapitel gefunden.{' '}
                {(playState === 'playing' || playState === 'paused') ? (
                  <span className="gamepad-inline-action">
                    <GamepadPrompt prompt="a" />
                    <span>zum Fortsetzen.</span>
                  </span>
                ) : (
                  <span className="gamepad-inline-action">
                    <GamepadPrompt prompt="a" />
                    <span>zum Abspielen.</span>
                  </span>
                )}
              </p>
            )}
            {chapters.length > 0 && (
              <ul className="chapter-overlay__list" ref={chapterListRef}>
                {chapters.map((ch, i) => (
                  <li
                    key={ch.positionSeconds}
                    className={`chapter-overlay__item${i === chapterIndex ? ' chapter-overlay__item--focused' : ''}`}
                  >
                    <span className="chapter-overlay__index">{i + 1}</span>
                    <span className="chapter-overlay__game">{ch.gameName}</span>
                    <span className="chapter-overlay__time">{formatTimestamp(ch.positionSeconds)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Player overlay – shown during VOD/Live playback */}
      {(playState === 'playing' || playState === 'paused') && (
        <PlaybackOverlay
          playState={playState}
          durationSeconds={vodDuration}
          isLive={isLivePlayback}
          currentPosition={currentPosition}
          channelName={channel.broadcasterName}
          channelAvatar={channel.profileImageUrl}
          title={isLivePlayback ? (channel.streamTitle ?? '') : (currentVod?.title ?? '')}
          onTogglePause={() => {
            if (playState === 'playing') {
              void window.t4sd.playback.pause()
              setPlayState('paused')
            } else {
              void window.t4sd.playback.resume()
              setPlayState('playing')
            }
          }}
          onSeek={(s) => void window.t4sd.playback.seek(s)}
          onSeekTo={(s) => void window.t4sd.playback.seekTo(s)}
          onStop={() => void handleStop()}
        />
      )}
    </div>
  )
}
