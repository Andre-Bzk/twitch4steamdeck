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

type Region = 'sidebar' | 'main'
type QuitChoice = 'yes' | 'no'

interface Props {
  onLogout: () => void
}

export default function AppShell({ onLogout }: Props): JSX.Element {
  const [tab, setTab] = useState<TabKey>('following')
  const [region, setRegion] = useState<Region>('main')
  const [sidebarIndex, setSidebarIndex] = useState(0)
  const [selectedChannel, setSelectedChannel] = useState<FollowedChannelInfo | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<GameInfo | null>(null)
  const [quitDialogOpen, setQuitDialogOpen] = useState(false)
  const [quitDialogChoice, setQuitDialogChoice] = useState<QuitChoice>('no')

  // Kanal-Info für den globalen Overlay — AppShell-spezifisch, kein Playback-State
  const [liveChannel, setLiveChannel] = useState<FollowedChannelInfo | null>(null)
  const [livePosition, setLivePosition] = useState(0)

  // Globale Playback-Session — aktiv wenn kein ChannelScreen offen ist
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

  // Direkt-Start: kein ChannelScreen — globaler Overlay startet sofort
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

  const handleBack = useCallback(() => {
    setSelectedChannel(null)
  }, [])

  const handleSelectCategory = useCallback((game: GameInfo) => {
    setSelectedCategory(game)
  }, [])

  // Key-Handler für den globalen Playback-Overlay (B=Stop, A=Pause, Pfeile=Seek)
  useEffect(() => {
    if (!isGlobalPlaying) return
    const onKey = (e: KeyboardEvent): void => {
      // Quality-Panel hat Vorrang wenn geöffnet
      if (liveQualityPanelOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setLiveQualityFocusedIndex((i) => Math.max(0, i - 1))
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          setLiveQualityFocusedIndex((i) => Math.min((liveAvailableQualities?.length ?? 1) - 1, i + 1))
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const q = liveAvailableQualities?.[liveQualityFocusedIndex]
          if (q && liveChannel) handleLiveQualityChange(q, liveChannel.broadcasterLogin)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setLiveQualityPanelOpen(false)
        }
        return
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          handleStopLive()
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (livePlayState === 'playing') {
            liveVideoRef.current?.pause()
            setLivePlayState('paused')
          } else if (livePlayState === 'paused') {
            liveVideoRef.current?.play()
            setLivePlayState('playing')
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          liveVideoRef.current?.seek(-30)
          break
        case 'ArrowRight':
          e.preventDefault()
          liveVideoRef.current?.seek(30)
          break
        case 'l2':
          e.preventDefault()
          liveVideoRef.current?.seek(-300)
          break
        case 'r2':
          e.preventDefault()
          liveVideoRef.current?.seek(300)
          break
        case 'x':
          e.preventDefault()
          if (liveAvailableQualities && liveAvailableQualities.length > 0) {
            const idx = liveAvailableQualities.indexOf(liveCurrentQuality)
            setLiveQualityFocusedIndex(idx >= 0 ? idx : 0)
            setLiveQualityPanelOpen(true)
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isGlobalPlaying, livePlayState, handleStopLive, liveQualityPanelOpen, liveAvailableQualities, liveQualityFocusedIndex, liveCurrentQuality, liveChannel, handleLiveQualityChange])

  // Key-Handler für die Sidebar (wenn sie den Fokus hat)
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
                title={activeItem.screen.title}
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
          {/* Lade-Overlay während streamlink läuft */}
          {livePlayState === 'starting' && !liveHlsPayload && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: '#000', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.25rem'
            }}>
              Starte Wiedergabe…
            </div>
          )}
          {/* Fehler-Overlay */}
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
                B / Esc — Schließen
              </p>
            </div>
          )}
          {/* VideoPlayer + Overlay sobald HLS-URL da ist */}
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
                  onTogglePause={() => {
                    if (livePlayState === 'playing') {
                      liveVideoRef.current?.pause()
                      setLivePlayState('paused')
                    } else {
                      liveVideoRef.current?.play()
                      setLivePlayState('playing')
                    }
                  }}
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
            <h2 id="quit-dialog-title" className="quit-dialog__title">App beenden?</h2>
            <p className="quit-dialog__text">Möchtest du Twitch4SteamDeck wirklich schließen?</p>
            <p className="quit-dialog__hint gamepad-hint-line">
              <GamepadHintItem prompt={['dpad-left', 'dpad-right']}>Auswahl</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="a">Bestätigen</GamepadHintItem>
              <span className="gamepad-hint-separator">·</span>
              <GamepadHintItem prompt="b">Abbrechen</GamepadHintItem>
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
                Ja
              </button>
              <button
                className={`btn quit-dialog__button${quitDialogChoice === 'no' ? ' quit-dialog__button--focused' : ''}`}
                onClick={closeQuitDialog}
                tabIndex={-1}
              >
                Nein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
