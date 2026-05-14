import { useEffect, useMemo, useRef, useState } from 'react'
import { GamepadHintItem, GamepadPrompt } from '../components/GamepadPrompt'
import { EyeIcon } from '../components/Icons'
import { PlaybackOverlay } from '../components/PlaybackOverlay'
import { VideoPlayer } from '../components/VideoPlayer'
import type { FollowedChannelInfo, VodChapter, VodInfo, VodProgress } from '../types/t4sd'
import { usePlaybackSession } from '../hooks/usePlaybackSession'
import {
  formatCount,
  formatDate,
  formatDuration,
  formatTimestamp,
  formatViewers,
  formatWatchedAt
} from '../lib/formatting'
import { CARD_GAP, CARD_W } from '../constants/ui'

interface Props {
  channel: FollowedChannelInfo
  onBack: () => void
}

type FocusRegion = 'hero' | 'shelf' | 'chapters'

function resolveThumbnail(url: string | undefined, w = 1280, h = 720): string | undefined {
  return url?.replace('{width}', String(w)).replace('{height}', String(h))
}

export default function ChannelScreen({ channel, onBack }: Props): JSX.Element {
  const [vods, setVods] = useState<VodInfo[]>([])
  const [vodsLoading, setVodsLoading] = useState(true)
  const [progressMap, setProgressMap] = useState<Record<string, VodProgress>>({})
  const [focusRegion, setFocusRegion] = useState<FocusRegion>('hero')
  const [shelfIndex, setShelfIndex] = useState(0)
  const [chapterPanelVod, setChapterPanelVod] = useState<VodInfo | null>(null)
  const [chapters, setChapters] = useState<VodChapter[]>([])
  const [vodChaptersLoaded, setVodChaptersLoaded] = useState(false)
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [currentVod, setCurrentVod] = useState<VodInfo | null>(null)
  const [pendingChapterVod, setPendingChapterVod] = useState<VodInfo | null>(null)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [vodDuration, setVodDuration] = useState(0)
  const [isLivePlayback, setIsLivePlayback] = useState(false)

  const watchBtnRef = useRef<HTMLButtonElement>(null)
  const chapterListRef = useRef<HTMLUListElement>(null)

  const loadChapters = async (vodId: string): Promise<VodChapter[]> => {
    return window.t4sd.twitch.getVodChapters(vodId)
  }

  const showChapterPanel = (vod: VodInfo): void => {
    setChapterPanelVod(vod)
    setChapters([])
    setChapterIndex(0)
    setChaptersLoading(true)
    setFocusRegion('chapters')
    void loadChapters(vod.id)
      .then((loaded) => setChapters(loaded))
      .catch(() => {})
      .finally(() => setChaptersLoading(false))
  }

  // Playback-Session — ChannelScreen ist immer der aktive Eigentümer wenn gemountet
  const session = usePlaybackSession({
    active: true,
    onStarted: (ev) => {
      setVodDuration(ev.durationSeconds ?? 0)
      setIsLivePlayback(ev.isLive ?? false)
      setCurrentPosition(0)
    },
    onStopped: () => {
      setChapterPanelVod(null)
      setCurrentVod(null)
      if (vods.length > 0) {
        void window.t4sd.history
          .getProgress(vods.map((v) => v.id))
          .then(setProgressMap)
          .catch(() => {})
      }
      if (pendingChapterVod) {
        setPendingChapterVod(null)
        showChapterPanel(pendingChapterVod)
      } else {
        setFocusRegion('shelf')
      }
    },
    onError: () => {
      setChapterPanelVod(null)
      setCurrentVod(null)
      setPendingChapterVod(null)
    },
  })
  const {
    hlsPayload, playState, videoRef,
    availableQualities, currentQuality, qualityPanelOpen, qualityFocusedIndex,
    errorMsg,
    setPlayState, setQualityPanelOpen, setQualityFocusedIndex,
    startLive, startVod, stop, handleVideoError,
  } = session

  // Derive active chapter name from chapters list + current playback position.
  // Three states: loading → undefined (chip hidden), loaded+empty → 'Unbekannt', loaded+chapters → active chapter.
  const currentChapterName = useMemo<string | undefined>(() => {
    if (isLivePlayback) return undefined
    if (!vodChaptersLoaded) return undefined
    if (chapters.length === 0) return 'Unbekannt'
    const active = [...chapters].reverse().find((ch) => ch.positionSeconds <= currentPosition)
    return active?.gameName ?? 'Unbekannt'
  }, [chapters, vodChaptersLoaded, currentPosition, isLivePlayback])

  const currentChapterIndex = useMemo<number | undefined>(() => {
    if (isLivePlayback || !vodChaptersLoaded || chapters.length === 0) return undefined
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].positionSeconds <= currentPosition) return i + 1
    }
    return 1
  }, [chapters, vodChaptersLoaded, currentPosition, isLivePlayback])

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
          setChapterPanelVod(null)
          setFocusRegion(duringPlayback ? 'hero' : 'shelf')
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
              videoRef.current?.seekTo(chapter.positionSeconds)
            }
            setChapterPanelVod(null)
            setFocusRegion('hero')
          } else {
            if (chapter) {
              void handleWatchVod(vod, chapter.positionSeconds)
            } else {
              void handleWatchVod(vod)
              setChapterPanelVod(null)
            }
          }
        } else if (e.key === 'x' && duringPlayback && chapters.length === 0 && !chaptersLoading) {
          e.preventDefault()
          videoRef.current?.seekTo(0)
          setChapterPanelVod(null)
          setFocusRegion('hero')
        }
        return
      }

      // Während der Wiedergabe: nur Playback-Steuerung erlauben, keine Navigation
      if (isPlaying) {
        // Quality-Panel hat Vorrang wenn geöffnet
        if (qualityPanelOpen) {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setQualityFocusedIndex((i) => Math.max(0, i - 1))
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setQualityFocusedIndex((i) => Math.min((availableQualities?.length ?? 1) - 1, i + 1))
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const q = availableQualities?.[qualityFocusedIndex]
            if (q) void handleQualityChange(q)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setQualityPanelOpen(false)
          }
          return
        }

        switch (e.key) {
          case 'l2':
            e.preventDefault()
            videoRef.current?.seek(-300)
            break
          case 'r2':
            e.preventDefault()
            videoRef.current?.seek(300)
            break
          case 'ArrowLeft':
            e.preventDefault()
            videoRef.current?.seek(-30)
            break
          case 'ArrowRight':
            e.preventDefault()
            videoRef.current?.seek(30)
            break
          case 'Enter':
          case ' ':
            e.preventDefault()
            if (playState === 'playing') {
              void window.t4sd.playback.pause()
              videoRef.current?.pause()
              setPlayState('paused')
            } else if (playState === 'paused') {
              videoRef.current?.play()
              setPlayState('playing')
            }
            break
          case 'Escape':
            e.preventDefault()
            stop()
            break
          case 'y': {
            e.preventDefault()
            const vod = currentVod ?? vods[shelfIndex]
            if (vod) showChapterPanel(vod)
            break
          }
          case 'x':
            e.preventDefault()
            if (availableQualities && availableQualities.length > 0) {
              const idx = availableQualities.indexOf(currentQuality)
              setQualityFocusedIndex(idx >= 0 ? idx : 0)
              setQualityPanelOpen(true)
            }
            break
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
          if (vod) showChapterPanel(vod)
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
  }, [focusRegion, playState, vods, shelfIndex, onBack, chapters, chapterIndex, chapterPanelVod, currentVod, qualityPanelOpen, availableQualities, qualityFocusedIndex, currentQuality])

  useEffect(() => {
    watchBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!chapterListRef.current) return
    const item = chapterListRef.current.children[chapterIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [chapterIndex])

  const jumpChapter = async (direction: 1 | -1): Promise<void> => {
    if (!currentVod) return

    const currentTime = videoRef.current?.getCurrentTime() ?? 0
    const loadedChapters = await loadChapters(currentVod.id)
    if (loadedChapters.length === 0) return

    const epsilon = 1
    const target = direction > 0
      ? loadedChapters.find((chapter) => chapter.positionSeconds > currentTime + epsilon)
      : [...loadedChapters].reverse().find((chapter) => chapter.positionSeconds < currentTime - epsilon)

    if (target) {
      videoRef.current?.seekTo(target.positionSeconds)
    }
  }

  const handleWatch = async (): Promise<void> => {
    await startLive(channel.broadcasterLogin)
  }

  const handleWatchVod = async (vod: VodInfo, startSeconds?: number): Promise<void> => {
    setFocusRegion('hero')
    setChapterPanelVod(null)
    setCurrentVod(vod)
    setPendingChapterVod(null)
    setVodChaptersLoaded(false)
    void loadChapters(vod.id)
      .then((loaded) => { setChapters(loaded); setVodChaptersLoaded(true) })
      .catch(() => { setVodChaptersLoaded(true) })
    await startVod(vod.id, channel.broadcasterLogin, vod.title, vod.durationSeconds, startSeconds)
  }

  const handleQualityChange = async (quality: string): Promise<void> => {
    const currentPos = videoRef.current?.getCurrentTime() ?? 0
    if (isLivePlayback) {
      await startLive(channel.broadcasterLogin, quality)
    } else if (currentVod) {
      await startVod(currentVod.id, channel.broadcasterLogin, currentVod.title, currentVod.durationSeconds, currentPos, quality)
    }
  }

  const thumb = resolveThumbnail(channel.thumbnailUrl)
  const trackOffset = shelfIndex * (CARD_W + CARD_GAP)
  const isActivePlayback = playState === 'playing' || playState === 'paused'

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

            {isActivePlayback && (
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
                      {vod.viewCount > 0 && (
                        <span className="channel-screen__vod-views">
                          {' · '}
                          <EyeIcon width={11} height={11} />
                          {' '}{formatCount(vod.viewCount)}
                        </span>
                      )}
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
              <div className="chapter-overlay__msg">
                <p>Keine Kapitel gefunden.</p>
                <p>
                  {isActivePlayback ? (
                    <>
                      <span className="gamepad-inline-action">
                        <GamepadPrompt prompt="a" />
                        <span>zum Fortsetzen.</span>
                      </span>
                      {' · '}
                      <span className="gamepad-inline-action">
                        <GamepadPrompt prompt="x" />
                        <span>zum Anfang springen.</span>
                      </span>
                    </>
                  ) : (
                    <span className="gamepad-inline-action">
                      <GamepadPrompt prompt="a" />
                      <span>zum Abspielen.</span>
                    </span>
                  )}
                </p>
              </div>
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

      {/* HTML5 Video Player — rendert innerhalb des Electron-Fensters */}
      {hlsPayload && (
        <VideoPlayer
          ref={videoRef}
          hlsUrl={hlsPayload.url}
          startPosition={hlsPayload.startPosition}
          isLive={hlsPayload.isLive}
          vodId={hlsPayload.vodId}
          durationSeconds={hlsPayload.durationSeconds}
          onTimeUpdate={(s) => setCurrentPosition(s)}
          onPlaying={() => setPlayState('playing')}
          onPaused={() => setPlayState('paused')}
          onEnded={stop}
          onError={handleVideoError}
        />
      )}

      {/* Player overlay – shown during VOD/Live playback, hidden while chapter panel is open */}
      {isActivePlayback && !chapterPanelVod && (
        <PlaybackOverlay
          playState={playState}
          durationSeconds={vodDuration}
          isLive={isLivePlayback}
          currentPosition={currentPosition}
          channelName={channel.broadcasterName}
          channelAvatar={channel.profileImageUrl}
          title={isLivePlayback ? (channel.streamTitle ?? '') : (currentVod?.title ?? '')}
          viewerCount={isLivePlayback ? (channel.viewerCount ?? undefined) : undefined}
          viewCount={!isLivePlayback ? (currentVod?.viewCount ?? undefined) : undefined}
          gameName={isLivePlayback ? (channel.gameName ?? undefined) : currentChapterName}
          currentChapterIndex={currentChapterIndex}
          totalChapters={vodChaptersLoaded && chapters.length > 0 ? chapters.length : undefined}
          availableQualities={availableQualities}
          currentQuality={currentQuality}
          qualityPanelOpen={qualityPanelOpen}
          qualityFocusedIndex={qualityFocusedIndex}
          onOpenQuality={() => {
            const idx = availableQualities?.indexOf(currentQuality) ?? 0
            setQualityFocusedIndex(idx >= 0 ? idx : 0)
            setQualityPanelOpen(true)
          }}
          onChangeQuality={(q) => void handleQualityChange(q)}
          onOpenChapters={!isLivePlayback && currentVod
            ? () => showChapterPanel(currentVod)
            : undefined}
          onTogglePause={() => {
            if (playState === 'playing') {
              void window.t4sd.playback.pause()
              videoRef.current?.pause()
              setPlayState('paused')
            } else {
              videoRef.current?.play()
              setPlayState('playing')
            }
          }}
          onSeek={(s) => videoRef.current?.seek(s)}
          onSeekTo={(s) => videoRef.current?.seekTo(s)}
          onStop={stop}
        />
      )}
    </div>
  )
}
