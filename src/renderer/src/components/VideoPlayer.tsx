import Hls from 'hls.js'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

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

const POSITION_REPORT_INTERVAL_MS = 5_000

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ hlsUrl, startPosition, isLive, vodId, durationSeconds, onPlaying, onPaused, onEnded, onError, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const hlsRef = useRef<Hls | null>(null)

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

    // HLS-Player initialisieren und URL laden
    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      // Bestehende hls.js-Instanz zerstören
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      console.log('[VideoPlayer] Hls.isSupported:', Hls.isSupported(), '| URL:', hlsUrl.slice(0, 80))

      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false })
        hlsRef.current = hls

        // Erst Media attachieren, dann Source laden (zuverlässiger in Electron/Chromium)
        hls.attachMedia(video)
        console.log('[VideoPlayer] attachMedia aufgerufen')

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log('[VideoPlayer] MEDIA_ATTACHED — lade Source')
          hls.loadSource(hlsUrl)
        })

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[VideoPlayer] MANIFEST_PARSED — readyState:', video.readyState, 'networkState:', video.networkState)
          if (startPosition > 0 && !isLive) {
            video.currentTime = startPosition
          }
          // Mit der korrekten Reihenfolge (attachMedia → MEDIA_ATTACHED → loadSource)
          // ist die MediaSource beim MANIFEST_PARSED-Event bereits am Video-Element —
          // play() kann direkt aufgerufen werden.
          video.play().then(() => {
            console.log('[VideoPlayer] play() erfolgreich')
          }).catch((err: unknown) => {
            console.error('[VideoPlayer] play() fehlgeschlagen:', err)
            onError?.(`Wiedergabe konnte nicht gestartet werden: ${err}`)
          })
        })

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          console.warn('[VideoPlayer] hls.js Fehler:', data.type, data.details, data.fatal)
          if (data.fatal) {
            onError?.(`HLS-Fehler: ${data.type} – ${data.details}`)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (nicht Electron, aber als Fallback)
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

    // VOD-Fortschritt alle 5s an Main-Prozess melden (für SQLite History)
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
