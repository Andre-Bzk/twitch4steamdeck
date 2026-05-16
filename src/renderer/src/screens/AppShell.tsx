// Global live-playback context: direct-start via A-button from browse screens.
// Live only — no VOD, no resume, no chapter panel.
// For the full channel-bound context (Live + VOD + chapters), see ChannelScreen.
//
// Two playback contexts:
// 1. ChannelScreen — Live + VOD with resume, chapters, position tracking.
//    Active when selectedChannel is set.
// 2. AppShell global overlay — Direct-start via A-button from BrowseScreen,
//    StreamListScreen, CategoryScreen. Live only, no resume. Controlled by
//    liveChannel / liveVideoRef.
// Both share usePlaybackSession() but hold independent videoRef instances.
import { useCallback, useEffect, useState } from 'react'
import { PlaybackOverlay } from '../components/PlaybackOverlay'
import { GamepadHintItem } from '../components/GamepadPrompt'
import Sidebar, { SIDEBAR_ITEMS, type TabKey } from '../components/Sidebar'
import { VideoPlayer } from '../components/VideoPlayer'
import AccountScreen from './AccountScreen'
import BrowseScreen from './BrowseScreen'
import CategoryScreen from './CategoryScreen'
import ChannelScreen from './ChannelScreen'
import FollowingScreen from './FollowingScreen'
import SettingsScreen from './SettingsScreen'
import StreamListScreen from './StreamListScreen'
import type { FollowedChannelInfo, GameInfo } from '../types/t4sd'
import { usePlaybackSession } from '../hooks/usePlaybackSession'
import { dispatchPlaybackKey, dispatchQualityPanelKey } from '../lib/playbackKeys'
import { useT } from '../i18n/useT'

type Region = 'sidebar' | 'main'
type QuitChoice = 'yes' | 'no'

interface Props {
  onLogout: () => void
}

export default function AppShell({ onLogout }: Props): JSX.Element {
  const t = useT()
  const [tab, setTab] = useState<TabKey>('following')
  const [region, setRegion] = useState<Region>('main')
  const [sidebarIndex, setSidebarIndex] = useState(0)
  const [selectedChannel, setSelectedChannel] = useState<FollowedChannelInfo | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<GameInfo | null>(null)
  const [quitDialogOpen, setQuitDialogOpen] = useState(false)
  const [quitDialogChoice, setQuitDialogChoice] = useState<QuitChoice>('no')

  // Channel info for the global overlay — AppShell-specific, not part of playback state
  const [liveChannel, setLiveChannel] = useState<FollowedChannelInfo | null>(null)
  const [livePosition, setLivePosition] = useState(0)

  // Global playback session — active when no ChannelScreen is open
  const globalSession = usePlaybackSession({
    active: !selectedChannel,
    onStopped: () => { setLiveChannel(null); setLivePosition(0) },
  })
  const {
    hlsPayload: liveHlsPayload,
    playState: livePlayState,
    videoRef: liveVideoRef,
    availableQualities: liveAvailableQualities,
    currentQuality: liveCurrentQuality,
    qualityPanelOpen: liveQualityPanelOpen,
    qualityFocusedIndex: liveQualityFocusedIndex,
    errorMsg: liveErrorMsg,
    isActive: isGlobalPlaying,
    setPlayState: setLivePlayState,
    setQualityPanelOpen: setLiveQualityPanelOpen,
    setQualityFocusedIndex: setLiveQualityFocusedIndex,
    startLive: startGlobalLive,
    stop: stopGlobal,
    handleVideoError: handleLiveVideoError,
  } = globalSession

  const requestSidebar = useCallback(() => {
    const idx = SIDEBAR_ITEMS.findIndex((t) => t.key === tab)
    setSidebarIndex(idx >= 0 ? idx : 0)
    setRegion('sidebar')
  }, [tab])

  const openQuitDialog = useCallback(() => {
    setQuitDialogChoice('no')
    setQuitDialogOpen(true)
  }, [])

  const closeQuitDialog = useCallback(() => {
    setQuitDialogChoice('no')
    setQuitDialogOpen(false)
  }, [])

  const confirmQuitDialog = useCallback(() => {
    if (quitDialogChoice === 'yes') {
      void window.t4sd.app.quit()
      return
    }
    closeQuitDialog()
  }, [closeQuitDialog, quitDialogChoice])

  const handleSelectChannel = useCallback((ch: FollowedChannelInfo) => {
    setSelectedChannel(ch)
  }, [])

  // Direct start: no ChannelScreen — global overlay starts immediately
  const handleStartLive = useCallback((ch: FollowedChannelInfo) => {
    setLiveChannel(ch)
    void startGlobalLive(ch.broadcasterLogin)
  }, [startGlobalLive])

  const handleStopLive = useCallback(() => {
    setLiveChannel(null)
    setLivePosition(0)
    stopGlobal()
  }, [stopGlobal])

  const handleLiveQualityChange = useCallback((quality: string, channelLogin: string) => {
    void startGlobalLive(channelLogin, quality)
  }, [startGlobalLive])

  const handleLiveTogglePause = useCallback(() => {
    if (livePlayState === 'playing') {
      liveVideoRef.current?.pause()
      setLivePlayState('paused')
    } else if (livePlayState === 'paused') {
      liveVideoRef.current?.play()
      setLivePlayState('playing')
    }
  }, [livePlayState, setLivePlayState])

  const handleBack = useCallback(() => {
    setSelectedChannel(null)
  }, [])

  const handleSelectCategory = useCallback((game: GameInfo) => {
    setSelectedCategory(game)
  }, [])

  // Key handler for the global playback overlay (B=Stop, A=Pause, arrows=Seek)
  useEffect(() => {
    if (!isGlobalPlaying) return
    const onKey = (e: KeyboardEvent): void => {
      if (liveQualityPanelOpen) {
        dispatchQualityPanelKey(e, {
          qualities: liveAvailableQualities ?? [],
          focusedIndex: liveQualityFocusedIndex,
          onMoveFocus: (d) => setLiveQualityFocusedIndex((i) =>
            d < 0 ? Math.max(0, i - 1) : Math.min((liveAvailableQualities?.length ?? 1) - 1, i + 1)),
          onApply: (q) => liveChannel && handleLiveQualityChange(q, liveChannel.broadcasterLogin),
          onClose: () => setLiveQualityPanelOpen(false),
        })
        return
      }
      dispatchPlaybackKey(e, {
        onTogglePause: handleLiveTogglePause,
        onSeek: (s) => liveVideoRef.current?.seek(s),
        onStop: handleStopLive,
        onOpenQuality: liveAvailableQualities?.length
          ? () => {
              const idx = liveAvailableQualities.indexOf(liveCurrentQuality)
              setLiveQualityFocusedIndex(idx >= 0 ? idx : 0)
              setLiveQualityPanelOpen(true)
            }
          : undefined,
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isGlobalPlaying, handleLiveTogglePause, handleStopLive, liveQualityPanelOpen,
      liveAvailableQualities, liveQualityFocusedIndex, liveCurrentQuality, liveChannel,
      handleLiveQualityChange, setLiveQualityFocusedIndex, setLiveQualityPanelOpen])

  // Key handler for the sidebar (when it has focus)
  useEffect(() => {
    if (region !== 'sidebar') return
    const onKey = (e: KeyboardEvent): void => {
      if (quitDialogOpen) {
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault()
            setQuitDialogChoice('yes')
            break
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault()
            setQuitDialogChoice('no')
            break
          case 'Enter':
          case ' ':
            e.preventDefault()
            confirmQuitDialog()
            break
          case 'Escape':
            e.preventDefault()
            closeQuitDialog()
            break
        }
        return
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSidebarIndex((i) => Math.max(0, i - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setSidebarIndex((i) => Math.min(SIDEBAR_ITEMS.length - 1, i + 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setRegion('main')
          break
        case 'Enter':
          e.preventDefault()
          setTab(SIDEBAR_ITEMS[sidebarIndex].key)
          setSelectedChannel(null)
          setSelectedCategory(null)
          setRegion('main')
          break
        case 'Escape':
          e.preventDefault()
          openQuitDialog()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [region, sidebarIndex, quitDialogOpen, openQuitDialog, closeQuitDialog, confirmQuitDialog])

  const mainFocus = region === 'main' && !isGlobalPlaying
  const activeItem = SIDEBAR_ITEMS.find((item) => item.key === tab) ?? SIDEBAR_ITEMS[0]

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={tab}
        focusedIndex={region === 'sidebar' ? sidebarIndex : -1}
        onItemClick={(k) => {
          setTab(k)
          setSelectedChannel(null)
          setSelectedCategory(null)
          setRegion('main')
        }}
      />
      <div className="main-content">
        {selectedChannel ? (
          <ChannelScreen channel={selectedChannel} onBack={handleBack} />
        ) : selectedCategory && activeItem.screen.kind === 'browse' ? (
          <CategoryScreen
            game={selectedCategory}
            onSelectChannel={handleSelectChannel}
            onStartLive={handleStartLive}
            onBack={() => setSelectedCategory(null)}
          />
        ) : (
          <>
            {activeItem.screen.kind === 'following' && (
              <FollowingScreen
                hasFocus={mainFocus}
                onRequestSidebar={requestSidebar}
                onSelectChannel={handleSelectChannel}
              />
            )}
            {activeItem.screen.kind === 'browse' && (
              <BrowseScreen
                hasFocus={mainFocus}
                onRequestSidebar={requestSidebar}
                onSelectChannel={handleSelectChannel}
                onStartLive={handleStartLive}
                onSelectCategory={handleSelectCategory}
              />
            )}
            {activeItem.screen.kind === 'stream-list' && (
              <StreamListScreen
                hasFocus={mainFocus}
                titleKey={activeItem.screen.titleKey}
                language={activeItem.screen.language}
                onRequestSidebar={requestSidebar}
                onSelectChannel={handleSelectChannel}
                onStartLive={handleStartLive}
              />
            )}
            {activeItem.screen.kind === 'account' && (
              <AccountScreen
                hasFocus={mainFocus}
                onRequestSidebar={requestSidebar}
                onLogout={onLogout}
              />
            )}
            {activeItem.screen.kind === 'settings' && (
              <SettingsScreen hasFocus={mainFocus} onRequestSidebar={requestSidebar} />
            )}
          </>
        )}
      </div>

      {/* Globaler Video-Overlay — startet direkt ohne ChannelScreen */}
      {isGlobalPlaying && !selectedChannel && (
        <>
          {/* Loading overlay while streamlink runs */}
          {!liveHlsPayload && livePlayState !== 'error' && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: '#000', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.25rem'
            }}>
              {t('playback.startingOverlay')}
            </div>
          )}
          {/* Error overlay */}
          {livePlayState === 'error' && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: '#000', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '1rem'
            }}>
              <p style={{ color: '#ff6868', fontSize: '1.1rem', maxWidth: '60ch', textAlign: 'center', margin: 0 }}>
                {liveErrorMsg}
              </p>
              <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                {t('playback.closeHint')}
              </p>
            </div>
          )}
          {/* VideoPlayer + overlay once the HLS URL has arrived */}
          {liveHlsPayload && (
            <>
              <VideoPlayer
                ref={liveVideoRef}
                hlsUrl={liveHlsPayload.url}
                startPosition={0}
                isLive={true}
                onPlaying={() => setLivePlayState('playing')}
                onPaused={() => setLivePlayState('paused')}
                onEnded={handleStopLive}
                onError={handleLiveVideoError}
                onTimeUpdate={(s) => setLivePosition(s)}
              />
              {(livePlayState === 'playing' || livePlayState === 'paused') && (
                <PlaybackOverlay
                  playState={livePlayState}
                  isLive={true}
                  durationSeconds={0}
                  currentPosition={livePosition}
                  channelName={liveChannel?.broadcasterName ?? ''}
                  channelAvatar={liveChannel?.profileImageUrl ?? ''}
                  title={liveChannel?.streamTitle ?? ''}
                  viewerCount={liveChannel?.viewerCount ?? undefined}
                  gameName={liveChannel?.gameName ?? undefined}
                  availableQualities={liveAvailableQualities}
                  currentQuality={liveCurrentQuality}
                  qualityPanelOpen={liveQualityPanelOpen}
                  qualityFocusedIndex={liveQualityFocusedIndex}
                  onOpenQuality={() => {
                    const idx = liveAvailableQualities?.indexOf(liveCurrentQuality) ?? 0
                    setLiveQualityFocusedIndex(idx >= 0 ? idx : 0)
                    setLiveQualityPanelOpen(true)
                  }}
                  onChangeQuality={(q) => liveChannel && handleLiveQualityChange(q, liveChannel.broadcasterLogin)}
                  onTogglePause={handleLiveTogglePause}
                  onSeek={(s) => liveVideoRef.current?.seek(s)}
                  onSeekTo={(s) => liveVideoRef.current?.seekTo(s)}
                  onStop={handleStopLive}
                />
              )}
            </>
          )}
        </>
      )}

      {quitDialogOpen && (
        <div className="quit-dialog-overlay">
          <div className="quit-dialog" role="dialog" aria-modal="true" aria-labelledby="quit-dialog-title">
            <h2 id="quit-dialog-title" className="quit-dialog__title">{t('quit.title')}</h2>
            <p className="quit-dialog__text">{t('quit.message')}</p>
            <p className="quit-dialog__hint gamepad-hint-line">
              <GamepadHintItem prompt={['dpad-left', 'dpad-right']}>{t('common.selection')}</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="a">{t('common.confirm')}</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="b">{t('common.cancel')}</GamepadHintItem>
            </p>
            <div className="quit-dialog__actions">
              <button
                className={`btn quit-dialog__button${quitDialogChoice === 'yes' ? ' quit-dialog__button--focused' : ''}`}
                onClick={() => {
                  setQuitDialogChoice('yes')
                  void window.t4sd.app.quit()
                }}
                tabIndex={-1}
              >
                {t('common.yes')}
              </button>
              <button
                className={`btn quit-dialog__button${quitDialogChoice === 'no' ? ' quit-dialog__button--focused' : ''}`}
                onClick={closeQuitDialog}
                tabIndex={-1}
              >
                {t('common.no')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
