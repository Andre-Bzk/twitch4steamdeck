// Video playback overlay rendered inside the Electron window.
// Responsibility: overlay UI only (seek bar, channel info, controls, hints).
// No screen navigation logic — that lives in the parent (AppShell / ChannelScreen).
import { useCallback, useEffect, useRef, useState } from 'react'
import { GamepadHintItem } from './GamepadPrompt'
import { ClapperboardIcon, EyeIcon, GamepadIcon, PauseIcon, PlayIcon, StopIcon } from './Icons'
import { QualityPanel } from './QualityPanel'
import { formatCount, formatTimestamp } from '../lib/formatting'
import { DOUBLE_TAP_MS, OVERLAY_HIDE_DELAY_MS } from '../constants/playback'
import { useT } from '../i18n/useT'

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
  currentChapterIndex?: number
  totalChapters?: number
  availableQualities?: string[]
  currentQuality?: string
  qualityPanelOpen?: boolean
  qualityFocusedIndex?: number
  onOpenQuality?: () => void
  onChangeQuality?: (q: string) => void
  onTogglePause: () => void
  onSeek: (seconds: number) => void
  onSeekTo: (seconds: number) => void
  onStop: () => void
  onOpenChapters?: () => void
}


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
  currentChapterIndex,
  totalChapters,
  availableQualities,
  currentQuality,
  qualityPanelOpen,
  qualityFocusedIndex,
  onOpenQuality,
  onChangeQuality,
  onTogglePause,
  onSeek,
  onSeekTo,
  onStop,
  onOpenChapters
}: PlaybackOverlayProps): JSX.Element {
  const t = useT()
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
    hideTimerRef.current = setTimeout(() => setVisible(false), OVERLAY_HIDE_DELAY_MS)
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
        <GamepadHintItem prompt="a">{playState === 'playing' ? t('playback.pause') : t('playback.resume')}</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="dpad-left">−30s</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="dpad-right">+30s</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="lt">−5min</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="rt">+5min</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="lb">{t('playback.chapterLeft')}</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="rb">{t('playback.chapterRight')}</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="y">{t('playback.chapterMenu')}</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="x">{t('playback.qualityHint')}</GamepadHintItem>
        <span className="playback-overlay__hint-sep">·</span>
        <GamepadHintItem prompt="b">{t('playback.stop')}</GamepadHintItem>
      </div>

      {/* Center play/pause button */}
      <div className="playback-overlay__center">
        <button
          className="playback-overlay__center-btn"
          onClick={() => { onTogglePause(); showOverlay() }}
          aria-label={playState === 'playing' ? t('playback.pause') : t('playback.playLabel')}
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
              {t('common.live')}
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
                  {currentChapterIndex !== undefined &&
                    totalChapters !== undefined &&
                    totalChapters > 1 && (
                      <span className="playback-overlay__chapter-badge">
                        {currentChapterIndex}/{totalChapters}
                      </span>
                    )}
                </span>
              )}
            </div>
            <div className="playback-overlay__progress-row">
              <span className="playback-overlay__time">{formatTimestamp(displayPosition)}</span>

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

              <span className="playback-overlay__time">{formatTimestamp(durationSeconds)}</span>
            </div>
          </>
        ) : null}

        {/* Action buttons row */}
        <div className="playback-overlay__action-row">
          {!isLive && totalChapters !== undefined && totalChapters > 0 && onOpenChapters && (
            <div className="playback-overlay__chapter-btn-wrap">
              <button
                className="playback-overlay__chapter-btn"
                onClick={() => { onOpenChapters(); showOverlay() }}
                aria-label={t('playback.openChapters')}
              >
                <ClapperboardIcon width={18} height={18} />
                <span>{t('playback.chapter')}</span>
              </button>
              {totalChapters > 1 && (
                <span className="playback-overlay__chapter-ios-badge">
                  {totalChapters}
                </span>
              )}
            </div>
          )}
          {onOpenQuality && availableQualities !== undefined && availableQualities.length > 0 && (
            <QualityPanel
              qualities={availableQualities}
              current={currentQuality ?? 'best'}
              open={qualityPanelOpen ?? false}
              focusedIndex={qualityFocusedIndex ?? 0}
              onOpen={() => { onOpenQuality(); showOverlay() }}
              onChange={(q) => { onChangeQuality?.(q); showOverlay() }}
            />
          )}
          <button
            className="playback-overlay__stop-btn"
            onClick={() => { onStop(); showOverlay() }}
            aria-label={t('playback.stop')}
          >
            <StopIcon width={18} height={18} />
            <span>{t('playback.stop')}</span>
          </button>
        </div>
      </div>

      {/* Bottom gradient scrim */}
      <div className="playback-overlay__scrim-bottom" />
    </div>
  )
}
