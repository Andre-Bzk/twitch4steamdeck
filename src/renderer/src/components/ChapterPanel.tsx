import { useEffect, useRef } from 'react'
import { GamepadHintItem, GamepadPrompt } from './GamepadPrompt'
import { formatTimestamp } from '../lib/formatting'
import type { VodChapter, VodInfo } from '../types/t4sd'

interface Props {
  vod: VodInfo
  chapters: VodChapter[]
  focusedIndex: number
  loading: boolean
  /** True when the chapter panel is opened during active playback (seek vs start). */
  duringPlayback: boolean
}

export function ChapterPanel({ vod, chapters, focusedIndex, loading, duringPlayback }: Props): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[focusedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedIndex])

  return (
    <div className="chapter-overlay">
      <div className="chapter-overlay__panel">
        <div className="chapter-overlay__header">
          <span className="chapter-overlay__title">Kapitel wählen</span>
          <span className="chapter-overlay__vod-name">{vod.title}</span>
        </div>
        <p className="chapter-overlay__hint gamepad-hint-line">
          <GamepadHintItem prompt={['dpad-up', 'dpad-down']}>Navigieren</GamepadHintItem>
          <span className="gamepad-hint-separator">·</span>
          <GamepadHintItem prompt="a">{duringPlayback ? 'Springen' : 'Starten'}</GamepadHintItem>
          <span className="gamepad-hint-separator">·</span>
          <GamepadHintItem prompt="b">Schließen</GamepadHintItem>
        </p>
        {loading && <p className="chapter-overlay__msg">Lade Kapitel…</p>}
        {!loading && chapters.length === 0 && (
          <div className="chapter-overlay__msg">
            <p>Keine Kapitel gefunden.</p>
            <p>
              {duringPlayback ? (
                <>
                  <span className="gamepad-inline-action">
                    <GamepadPrompt prompt="a" />
                    <span>zum Fortsetzen.</span>
                  </span>
                  {' · '}
                  <span className="gamepad-inline-action">
                    <GamepadPrompt prompt="x" />
                    <span>zum Anfang springen.</span>
                  </span>
                </>
              ) : (
                <span className="gamepad-inline-action">
                  <GamepadPrompt prompt="a" />
                  <span>zum Abspielen.</span>
                </span>
              )}
            </p>
          </div>
        )}
        {chapters.length > 0 && (
          <ul className="chapter-overlay__list" ref={listRef}>
            {chapters.map((ch, i) => (
              <li
                key={ch.positionSeconds}
                className={`chapter-overlay__item${i === focusedIndex ? ' chapter-overlay__item--focused' : ''}`}
              >
                <span className="chapter-overlay__index">{i + 1}</span>
                <span className="chapter-overlay__game">{ch.gameName}</span>
                <span className="chapter-overlay__time">{formatTimestamp(ch.positionSeconds)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
