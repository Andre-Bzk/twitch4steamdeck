import { useEffect, useRef } from 'react'
import type { FollowedChannelInfo } from '../types/t4sd'

interface Props {
  channel: FollowedChannelInfo
  focused: boolean
  onFocus: () => void
  onSelect: () => void
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Mio.`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function FocusableCard({ channel, focused, onFocus, onSelect }: Props): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focused) {
      ref.current?.focus({ preventScroll: true })
      ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }
  }, [focused])

  return (
    <button
      ref={ref}
      className={`card${focused ? ' card--focused' : ''}`}
      onFocus={onFocus}
      onClick={onSelect}
      tabIndex={focused ? 0 : -1}
    >
      <div className="card__thumb">
        {channel.isLive && channel.thumbnailUrl ? (
          <>
            <img src={channel.thumbnailUrl} alt="" draggable={false} />
            <span className="card__live-badge">LIVE</span>
            {channel.viewerCount !== undefined && (
              <span className="card__viewers">{formatViewers(channel.viewerCount)}</span>
            )}
          </>
        ) : (
          <div className="card__thumb-offline">
            {channel.profileImageUrl && (
              <img src={channel.profileImageUrl} alt="" draggable={false} />
            )}
          </div>
        )}
      </div>
      <div className="card__info">
        <div className="card__name-row">
          {channel.profileImageUrl && (
            <img
              className="card__avatar"
              src={channel.profileImageUrl}
              alt=""
              draggable={false}
            />
          )}
          <span className="card__name">{channel.broadcasterName}</span>
        </div>
        {channel.isLive ? (
          <>
            {channel.streamTitle && <span className="card__title">{channel.streamTitle}</span>}
            {channel.gameName && <span className="card__meta">{channel.gameName}</span>}
          </>
        ) : (
          <span className="card__offline-label">Offline</span>
        )}
      </div>
    </button>
  )
}
