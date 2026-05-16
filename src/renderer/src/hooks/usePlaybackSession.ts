import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { HlsUrlPayload, PlaybackEvent } from '../types/t4sd'
import type { VideoPlayerHandle } from '../components/VideoPlayer'

// Shared playback session mechanics for ChannelScreen and AppShell.
// Owns: HLS payload state, playState transitions (via IPC events), quality list,
//       the videoRef passed to <VideoPlayer>, and the start/stop commands.
// Does NOT own: overlay visibility, chapter state, position tracking — those
// belong to the caller (ChannelScreen or AppShell).

export type PlayState = 'idle' | 'starting' | 'playing' | 'paused' | 'error'

export interface PlaybackSession {
  // ── Session state (driven by IPC events) ─────────────────────────────────
  hlsPayload: HlsUrlPayload | null
  playState: PlayState
  videoRef: RefObject<VideoPlayerHandle>
  availableQualities: string[] | undefined
  currentQuality: string
  errorMsg: string
  isActive: boolean

  // ── Quality-panel UI state (caller drives the panel; hook stores it so
  //    both the key handler and the overlay prop always see the same value) ──
  qualityPanelOpen: boolean
  qualityFocusedIndex: number
  setPlayState: Dispatch<SetStateAction<PlayState>>
  setQualityPanelOpen: Dispatch<SetStateAction<boolean>>
  setQualityFocusedIndex: Dispatch<SetStateAction<number>>

  // ── Commands ──────────────────────────────────────────────────────────────
  startLive: (login: string, quality?: string) => Promise<void>
  startVod: (vodId: string, login: string, title: string, duration: number, startSeconds?: number, quality?: string) => Promise<void>
  stop: () => void
  handleVideoError: (msg: string) => void
}

interface Options {
  /** Subscribe to IPC playback events only when true. Set to false when
   *  another playback context (ChannelScreen) is mounted and should own the session. */
  active: boolean
  /** Called when a new stream/VOD has started and the first event arrives. */
  onStarted?: (ev: PlaybackEvent) => void
  /** Called when playback stops (user stop, stream end, or error recovery). */
  onStopped?: () => void
  /** Called on a fatal playback error, before the session resets to idle. */
  onError?: () => void
}

export function usePlaybackSession({ active, onStarted, onStopped, onError }: Options): PlaybackSession {
  const [hlsPayload, setHlsPayload] = useState<HlsUrlPayload | null>(null)
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [availableQualities, setAvailableQualities] = useState<string[] | undefined>()
  const [currentQuality, setCurrentQuality] = useState('best')
  const [qualityPanelOpen, setQualityPanelOpen] = useState(false)
  const [qualityFocusedIndex, setQualityFocusedIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const videoRef = useRef<VideoPlayerHandle>(null)

  // Refs keep callbacks current inside the IPC subscription without resubscribing on every render
  const onStartedRef = useRef(onStarted)
  const onStoppedRef = useRef(onStopped)
  const onErrorRef = useRef(onError)
  useEffect(() => { onStartedRef.current = onStarted })
  useEffect(() => { onStoppedRef.current = onStopped })
  useEffect(() => { onErrorRef.current = onError })

  const reset = useCallback(() => {
    setHlsPayload(null)
    setPlayState('idle')
    setAvailableQualities(undefined)
    setCurrentQuality('best')
    setQualityPanelOpen(false)
    setErrorMsg('')
  }, [])

  useEffect(() => {
    if (!active) return
    const unsubHls = window.t4sd.playback.onHlsUrl(setHlsPayload)
    const unsubEvent = window.t4sd.playback.onEvent((ev: PlaybackEvent) => {
      if (ev.kind === 'started') {
        setPlayState('playing')
        onStartedRef.current?.(ev)
      } else if (ev.kind === 'stopped') {
        reset()
        onStoppedRef.current?.()
      } else if (ev.kind === 'error') {
        setHlsPayload(null)
        setPlayState('error')
        setErrorMsg(ev.message ?? 'Unbekannter Fehler')
        setAvailableQualities(undefined)
        setQualityPanelOpen(false)
        onErrorRef.current?.()
      }
    })
    return () => { unsubHls(); unsubEvent() }
  }, [active, reset])

  const startLive = useCallback(async (login: string, quality?: string) => {
    videoRef.current?.stop()
    setPlayState('starting')
    setHlsPayload(null)
    setAvailableQualities(undefined)
    setCurrentQuality(quality ?? 'best')
    setQualityPanelOpen(false)
    setErrorMsg('')
    try {
      await window.t4sd.playback.startLive(login, quality)
    } catch (e) {
      setPlayState('error')
      setErrorMsg(String(e))
      return
    }
    void window.t4sd.playback.getQualities(`twitch.tv/${login}`)
      .then(qs => setAvailableQualities(qs.length > 0 ? qs : []))
      .catch(() => setAvailableQualities([]))
  }, [])

  const startVod = useCallback(async (
    vodId: string, login: string, title: string, duration: number,
    startSeconds?: number, quality?: string
  ) => {
    videoRef.current?.stop()
    setPlayState('starting')
    setHlsPayload(null)
    setAvailableQualities(undefined)
    setCurrentQuality(quality ?? 'best')
    setQualityPanelOpen(false)
    setErrorMsg('')
    try {
      await window.t4sd.playback.startVod(vodId, login, title, duration, startSeconds, quality)
    } catch (e) {
      setPlayState('error')
      setErrorMsg(String(e))
      return
    }
    void window.t4sd.playback.getQualities(`twitch.tv/videos/${vodId}`)
      .then(qs => setAvailableQualities(qs.length > 0 ? qs : []))
      .catch(() => setAvailableQualities([]))
  }, [])

  const stop = useCallback(() => {
    videoRef.current?.stop()
    reset()
    void window.t4sd.playback.stop()
  }, [reset])

  const handleVideoError = useCallback((msg: string) => {
    setHlsPayload(null)
    setPlayState('error')
    setErrorMsg(msg)
  }, [])

  return {
    hlsPayload,
    playState,
    videoRef,
    availableQualities,
    currentQuality,
    qualityPanelOpen,
    qualityFocusedIndex,
    errorMsg,
    isActive: playState !== 'idle',
    setPlayState,
    setQualityPanelOpen,
    setQualityFocusedIndex,
    startLive,
    startVod,
    stop,
    handleVideoError,
  }
}
