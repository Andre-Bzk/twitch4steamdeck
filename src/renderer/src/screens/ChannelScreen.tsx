import { useEffect, useRef, useState } from 'react'
import type { FollowedChannelInfo, PlaybackEvent } from '../types/t4sd'

interface Props {
  channel: FollowedChannelInfo
  onBack: () => void
}

type PlayState = 'idle' | 'starting' | 'playing' | 'error'

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Mio.`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function resolveThumbnail(url: string | undefined, w = 1280, h = 720): string | undefined {
  return url?.replace('{width}', String(w)).replace('{height}', String(h))
}

export default function ChannelScreen({ channel, onBack }: Props): JSX.Element {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const watchBtnRef = useRef<HTMLButtonElement>(null)

  // Escape / B → zurück (nur wenn nicht gerade Wiedergabe läuft)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (playState === 'playing' || playState === 'starting') {
          void window.t4sd.playback.stop()
        } else {
          onBack()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playState, onBack])

  // Playback-Events aus dem Main-Prozess
  useEffect(() => {
    const unsub = window.t4sd.playback.onEvent((ev: PlaybackEvent) => {
      if (ev.kind === 'started') {
        setPlayState('playing')
      } else if (ev.kind === 'stopped') {
        setPlayState('idle')
      } else if (ev.kind === 'error') {
        setPlayState('error')
        setErrorMsg(ev.message ?? 'Unbekannter Fehler')
      }
    })
    return unsub
  }, [])

  // Initial-Fokus auf "Live ansehen"-Button
  useEffect(() => {
    watchBtnRef.current?.focus()
  }, [])

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

  const handleStop = async (): Promise<void> => {
    await window.t4sd.playback.stop()
  }

  const thumb = resolveThumbnail(channel.thumbnailUrl)

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

            {playState === 'starting' && (
              <button className="btn" disabled>
                Starte Wiedergabe…
              </button>
            )}

            {playState === 'playing' && (
              <>
                <span className="channel-screen__playing-hint">● Wiedergabe läuft in mpv</span>
                <button className="btn" onClick={() => void handleStop()}>
                  ■ Stop (B / Escape)
                </button>
              </>
            )}

            {!channel.isLive && playState === 'idle' && (
              <p className="channel-screen__offline">Kanal ist gerade offline.</p>
            )}

            {playState === 'error' && (
              <p className="channel-screen__error">{errorMsg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
