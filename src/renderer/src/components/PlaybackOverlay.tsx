import { useCallback, useEffect, useRef, useState } from 'react'
import { GamepadHintItem } from './GamepadPrompt'
import { ClapperboardIcon, EyeIcon, GamepadIcon, PauseIcon, PlayIcon, StopIcon } from './Icons'

interface PlaybackOverlayProps {
  playState: 'playing' | 'paused'
  durationSeconds: number
  isLive: boolean
  currentPosition: number
  channelName: string
  channelAvatar: string
  title: string
  viewerCount?: number
  viewCount?: number
  gameName?: string
  onTogglePause: () => void
  onSeek: (seconds: number) => void
  onSeekTo: (seconds: number) => void
  onStop: () => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Formats seconds as HH:MM:SS */
function fmt(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const HIDE_DELAY_MS = 5_000
const DOUBLE_TAP_MS = 300

export function PlaybackOverlay({
  playState,
  durationSeconds,
  isLive,
  currentPosition,
  channelName,
  channelAvatar,
  title,
  viewerCount,
  viewCount,
  gameName,
  onTogglePause,
  onSeek,
  onSeekTo,
  onStop
}: PlaybackOverlayProps): JSX.Element {
  const [visible, setVisible] = useState(true)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubPosition, setScrubPosition] = useState(0)
  // "+10s" / "-10s" skip feedback
  const [skipFeedback, setSkipFeedback] = useState<{ side: 'left' | 'right'; key: number } | null>(null)

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seekBarRef = useRef<HTMLDivElement>(null)

  // Double-tap tracking
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'center' } | null>(null)

  // ─── Auto-hide logic ────────────────────────────────────────────────────────

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS)
  }, [clearHideTimer])

  /** Call on any user interaction to show overlay and reset auto-hide timer. */
  const showOverlay = useCallback(() => {
    setVisible(true)
    if (playState === 'playing') {
      scheduleHide()
    } else {
      clearHideTimer()
    }
  }, [playState, scheduleHide, clearHideTimer])

  // React to playState changes
  useEffect(() => {
    if (playState === 'paused') {
      clearHideTimer()
      setVisible(true)
    } else if (playState === 'playing') {
      scheduleHide()
    }
  }, [playState, clearHideTimer, scheduleHide])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearHideTimer()
  }, [clearHideTimer])

  // Listen for keyboard events to show overlay on controller interaction
  useEffect(() => {
    const onKey = (): void => showOverlay()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showOverlay])

  // ─── Seek bar ───────────────────────────────────────────────────────────────

  const positionForEvent = useCallback((e: React.PointerEvent<HTMLDivElement>): number => {
    const bar = seekBarRef.current
    if (!bar || durationSeconds <= 0) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return ratio * durationSeconds
  }, [durationSeconds])

  const onSeekBarPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (isLive || durationSeconds <= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = positionForEvent(e)
    setIsScrubbing(true)
    setScrubPosition(pos)
    showOverlay()
    clearHideTimer() // keep overlay visible during scrub
  }, [isLive, durationSeconds, positionForEvent, showOverlay, clearHideTimer])

  const onSeekBarPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isScrubbing) return
    setScrubPosition(positionForEvent(e))
  }, [isScrubbing, positionForEvent])

  const onSeekBarPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isScrubbing) return
    const pos = positionForEvent(e)
    setIsScrubbing(false)
    onSeekTo(pos)
    showOverlay() // restart hide timer after seek
  }, [isScrubbing, positionForEvent, onSeekTo, showOverlay])

  // ─── Double-tap skip zones ──────────────────────────────────────────────────

  const showSkipFeedback = useCallback((side: 'left' | 'right') => {
    setSkipFeedback({ side, key: Date.now() })
    setTimeout(() => setSkipFeedback(null), 700)
  }, [])

  const onOverlayPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    // Ignore if click came from seekbar or buttons
    if ((e.target as HTMLElement).closest('.playback-overlay__seek-bar, button, img')) return

    const width = (e.currentTarget as HTMLDivElement).offsetWidth
    const x = e.nativeEvent.offsetX
    const side: 'left' | 'right' | 'center' =
      x < width * 0.33 ? 'left' : x > width * 0.67 ? 'right' : 'center'

    const now = Date.now()
    const last = lastTapRef.current

    if (last && now - last.time < DOUBLE_TAP_MS && last.side === side && side !== 'center') {
      // Double tap
      lastTapRef.current = null
      if (side === 'left') {
        onSeek(-10)
        showSkipFeedback('left')
      } else {
        onSeek(10)
        showSkipFeedback('right')
      }
    } else {
      lastTapRef.current = { time: now, side }
      // Single tap: toggle overlay visibility
      if (!visible) {
        showOverlay()
      } else if (playState === 'playing') {
        scheduleHide()
      }
    }
  }, [visible, playState, onSeek, showOverlay, scheduleHide, showSkipFeedback])

  // ─── Derived values ─────────────────────────────────────────────────────────

  const displayPosition = isScrubbing ? scrubPosition : currentPosition
  const progress = durationSeconds > 0 ? Math.min(1, displayPosition / durationSeconds) : 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="playback-overlay"
      data-visible={visible}
      onPointerDown={onOverlayPointerDown}
      onMouseMove={showOverlay}
    >
      {/* Top gradient scrim */}
      <div className="playback-overlay__scrim-top" />

      {/* Top hints bar */}
      <div className="playback-overlay__top-bar">
        <GamepadHintItem prompt="a">{playState === 'playing' ? 'Pause' : 'Resume'}</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="dpad-left">−30s</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="dpad-right">+30s</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="lt">−5min</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="rt">+5min</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="lb">Kapitel ←</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="rb">Kapitel →</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="y">Kapitelmenü</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="b">Stop</GamepadHintItem>
      </div>

      {/* Center play/pause button */}
      <div className="playback-overlay__center">
        <button
          className="playback-overlay__center-btn"
          onClick={() => { onTogglePause(); showOverlay() }}
          aria-label={playState === 'playing' ? 'Pause' : 'Wiedergabe'}
        >
          {playState === 'playing'
            ? <PauseIcon width={40} height={40} />
            : <PlayIcon width={40} height={40} />
          }
        </button>
      </div>

      {/* Double-tap skip feedback */}
      {skipFeedback && (
        <div
          key={skipFeedback.key}
          className={`playback-overlay__skip-feedback playback-overlay__skip-feedback--${skipFeedback.side}`}
        >
          {skipFeedback.side === 'left' ? '−10s' : '+10s'}
        </div>
      )}

      {/* Bottom bar */}
      <div className="playback-overlay__bottom">
        {/* Channel info */}
        <div className="playback-overlay__channel">
          {channelAvatar && (
            <img
              className="playback-overlay__avatar"
              src={channelAvatar}
              alt={channelName}
              draggable={false}
            />
          )}
          <span className="playback-overlay__channel-name">{channelName}</span>
          {isLive && <span className="playback-overlay__live-badge">LIVE</span>}
        </div>

        {/* Video title */}
        {title && <p className="playback-overlay__title">{title}</p>}

        {/* Progress row / status row */}
        {isLive ? (
          <div className="playback-overlay__meta-row">
            <div className="playback-overlay__live-indicator">
              <span className="playback-overlay__live-dot" />
              Live
            </div>
            {viewerCount !== undefined && viewerCount > 0 && (
              <span className="playback-overlay__meta-chip">
                <EyeIcon width={14} height={14} />
                {formatCount(viewerCount)}
              </span>
            )}
            {gameName && (
              <span className="playback-overlay__meta-chip">
                <GamepadIcon width={14} height={14} />
                {gameName}
              </span>
            )}
          </div>
        ) : durationSeconds > 0 ? (
          <>
            <div className="playback-overlay__meta-row">
              <div className="playback-overlay__vod-badge">
                <ClapperboardIcon width={13} height={13} />
                VOD
              </div>
              {viewCount !== undefined && viewCount > 0 && (
                <span className="playback-overlay__meta-chip">
                  <EyeIcon width={14} height={14} />
                  {formatCount(viewCount)}
                </span>
              )}
              {gameName && (
                <span className="playback-overlay__meta-chip">
                  <GamepadIcon width={14} height={14} />
                  {gameName}
                </span>
              )}
            </div>
            <div className="playback-overlay__progress-row">
              <span className="playback-overlay__time">{fmt(displayPosition)}</span>

              <div
                ref={seekBarRef}
                className="playback-overlay__seek-bar"
                onPointerDown={onSeekBarPointerDown}
                onPointerMove={onSeekBarPointerMove}
                onPointerUp={onSeekBarPointerUp}
                onPointerCancel={onSeekBarPointerUp}
              >
                <div className="playback-overlay__seek-track">
                  <div
                    className="playback-overlay__seek-filled"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <div
                    className="playback-overlay__seek-knob"
                    style={{ left: `${progress * 100}%` }}
                  />
                </div>
              </div>

              <span className="playback-overlay__time">{fmt(durationSeconds)}</span>
            </div>
          </>
        ) : null}

        {/* Stop button */}
        <button
          className="playback-overlay__stop-btn"
          onClick={() => { onStop(); showOverlay() }}
          aria-label="Stop"
        >
          <StopIcon width={18} height={18} />
          <span>Stop</span>
        </button>
      </div>

      {/* Bottom gradient scrim */}
      <div className="playback-overlay__scrim-bottom" />
    </div>
  )
}
