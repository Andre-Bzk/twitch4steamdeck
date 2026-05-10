import { useCallback, useEffect, useRef, useState } from 'react'
import { PlaybackOverlay } from '../components/PlaybackOverlay'
import { GamepadHintItem } from '../components/GamepadPrompt'
import Sidebar, { SIDEBAR_ITEMS, type TabKey } from '../components/Sidebar'
import { VideoPlayer, type VideoPlayerHandle } from '../components/VideoPlayer'
import AccountScreen from './AccountScreen'
import BrowseScreen from './BrowseScreen'
import CategoryScreen from './CategoryScreen'
import ChannelScreen from './ChannelScreen'
import FollowingScreen from './FollowingScreen'
import SettingsScreen from './SettingsScreen'
import StreamListScreen from './StreamListScreen'
import type { FollowedChannelInfo, GameInfo, HlsUrlPayload } from '../types/t4sd'

type Region = 'sidebar' | 'main'
type QuitChoice = 'yes' | 'no'
type GlobalPlayState = 'idle' | 'starting' | 'playing' | 'paused'

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

  // Globaler Playback-State — für Direkt-Start aus BrowseScreen/StreamListScreen/CategoryScreen
  const [liveChannel, setLiveChannel] = useState<FollowedChannelInfo | null>(null)
  const [liveHlsPayload, setLiveHlsPayload] = useState<HlsUrlPayload | null>(null)
  const [livePlayState, setLivePlayState] = useState<GlobalPlayState>('idle')
  const [livePosition, setLivePosition] = useState(0)
  const liveVideoRef = useRef<VideoPlayerHandle>(null)
  // Verhindert dass ChannelScreen-Events den globalen Overlay aktivieren
  const isGlobalPlaybackInitiated = useRef(false)

  const isGlobalPlaying = livePlayState !== 'idle'

  // IPC-Listener für globalen Playback (nur wenn kein ChannelScreen aktiv)
  useEffect(() => {
    const unsubHls = window.t4sd.playback.onHlsUrl((payload: HlsUrlPayload) => {
      if (isGlobalPlaybackInitiated.current) {
        setLiveHlsPayload(payload)
      }
    })
    const unsubEvent = window.t4sd.playback.onEvent((ev) => {
      if (!isGlobalPlaybackInitiated.current) return
      if (ev.kind === 'started') {
        setLivePlayState('playing')
      } else if (ev.kind === 'stopped' || ev.kind === 'error') {
        isGlobalPlaybackInitiated.current = false
        setLiveHlsPayload(null)
        setLivePlayState('idle')
        setLiveChannel(null)
        setLivePosition(0)
      }
    })
    return () => { unsubHls(); unsubEvent() }
  }, [])

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
    isGlobalPlaybackInitiated.current = true
    setLiveChannel(ch)
    setLivePlayState('starting')
    void window.t4sd.playback.startLive(ch.broadcasterLogin)
  }, [])

  const handleStopLive = useCallback(() => {
    liveVideoRef.current?.stop()
    void window.t4sd.playback.stop()
  }, [])

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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isGlobalPlaying, livePlayState, handleStopLive])

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
                onError={() => {
                  isGlobalPlaybackInitiated.current = false
                  setLiveHlsPayload(null)
                  setLivePlayState('idle')
                  setLiveChannel(null)
                }}
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
