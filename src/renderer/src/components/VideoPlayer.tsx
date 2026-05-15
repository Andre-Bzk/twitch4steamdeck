import Hls from 'hls.js'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { POSITION_REPORT_INTERVAL_MS } from '../constants/playback'
import { useSettings } from '../context/SettingsContext'
import { NoCacheLoader } from '../lib/hlsNoCacheLoader'
import log from 'electron-log/renderer'

export interface VideoPlayerHandle {
  seek(delta: number): void
  seekTo(abs: number): void
  togglePause(): void
  pause(): void
  play(): void
  stop(): void
  getCurrentTime(): number
}

interface Props {
  hlsUrl: string
  startPosition: number
  isLive: boolean
  vodId?: string
  durationSeconds?: number
  onPlaying?: () => void
  onPaused?: () => void
  onEnded?: () => void
  onError?: (msg: string) => void
  onTimeUpdate?: (seconds: number) => void
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ hlsUrl, startPosition, isLive, vodId, durationSeconds, onPlaying, onPaused, onEnded, onError, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const { settings } = useSettings()

    useImperativeHandle(ref, () => ({
      seek(delta: number) {
        const v = videoRef.current
        if (!v) return
        v.currentTime = Math.max(0, v.currentTime + delta)
      },
      seekTo(abs: number) {
        const v = videoRef.current
        if (!v) return
        v.currentTime = Math.max(0, abs)
      },
      togglePause() {
        const v = videoRef.current
        if (!v) return
        if (v.paused) v.play().catch(() => {})
        else v.pause()
      },
      pause() {
        videoRef.current?.pause()
      },
      play() {
        videoRef.current?.play().catch(() => {})
      },
      stop() {
        const hls = hlsRef.current
        if (hls) {
          hls.destroy()
          hlsRef.current = null
        }
        const v = videoRef.current
        if (v) {
          v.src = ''
          v.load()
        }
      },
      getCurrentTime() {
        return videoRef.current?.currentTime ?? 0
      }
    }))

    // Initialize hls.js and load the URL
    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      // Tear down any existing hls.js instance
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      log.info('[VideoPlayer] Hls.isSupported:', Hls.isSupported(), '| URL:', hlsUrl.slice(0, 80))

      if (Hls.isSupported()) {
        const hlsConfig: Partial<Hls['config']> = { enableWorker: false }
        if (!settings.hlsCacheEnabled) {
          // XHR-based approaches (xhrSetup, webRequest hooks) cannot prevent Chromium's HTTP
          // disk cache from storing responses — the cache layer ignores no-store in XHR request
          // headers. The Fetch API's cache mode is the only reliable mechanism: it is evaluated
          // before the cache storage decision is made.
          hlsConfig.loader = NoCacheLoader
        }
        const hls = new Hls(hlsConfig)
        hlsRef.current = hls

        // Attach media first, then load the source — more reliable in Electron/Chromium
        hls.attachMedia(video)
        log.info('[VideoPlayer] attachMedia aufgerufen')

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          log.info('[VideoPlayer] MEDIA_ATTACHED — lade Source')
          hls.loadSource(hlsUrl)
        })

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          log.info('[VideoPlayer] MANIFEST_PARSED — readyState:', video.readyState, 'networkState:', video.networkState)
          if (startPosition > 0 && !isLive) {
            video.currentTime = startPosition
          }
          // With the correct order (attachMedia → MEDIA_ATTACHED → loadSource)
          // the MediaSource is already attached at MANIFEST_PARSED — play() is safe to call.
          video.play().then(() => {
            log.info('[VideoPlayer] play() erfolgreich')
          }).catch((err: unknown) => {
            log.error('[VideoPlayer] play() fehlgeschlagen:', err)
            onError?.(`Wiedergabe konnte nicht gestartet werden: ${err}`)
          })
        })

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          log.warn('[VideoPlayer] hls.js Fehler:', data.type, data.details, data.fatal)
          if (data.fatal) {
            onError?.(`HLS-Fehler: ${data.type} – ${data.details}`)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (not Electron, but as a fallback)
        video.src = hlsUrl
        if (startPosition > 0 && !isLive) {
          video.currentTime = startPosition
        }
        video.play().catch(() => {})
      } else {
        onError?.('HLS wird in dieser Umgebung nicht unterstützt')
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hlsUrl])

    // Report VOD progress every 5 s to the main process (SQLite history)
    useEffect(() => {
      if (!vodId || !durationSeconds || isLive) return
      const id = setInterval(() => {
        const v = videoRef.current
        if (!v || v.paused || v.ended) return
        void window.t4sd.playback.reportPosition(vodId, v.currentTime, durationSeconds)
      }, POSITION_REPORT_INTERVAL_MS)
      return () => clearInterval(id)
    }, [vodId, durationSeconds, isLive])

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onPlaying={onPlaying}
          onPause={onPaused}
          onEnded={onEnded}
          onTimeUpdate={(e) => onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)}
        />
      </div>
    )
  }
)

VideoPlayer.displayName = 'VideoPlayer'
