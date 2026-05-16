import { QualityIcon } from './Icons'
import { useT } from '../i18n/useT'

interface Props {
  qualities: string[]
  current: string
  open: boolean
  focusedIndex: number
  /** Called when the quality button is clicked — caller wraps with showOverlay if needed. */
  onOpen: () => void
  /** Called when a quality item is clicked — caller wraps with showOverlay if needed. */
  onChange: (quality: string) => void
}

export function QualityPanel({ qualities, current, open, focusedIndex, onOpen, onChange }: Props): JSX.Element {
  const t = useT()
  return (
    <div className="playback-overlay__quality-wrap">
      <button
        className="playback-overlay__quality-btn"
        onClick={onOpen}
        aria-label={t('quality.changeAria')}
      >
        <QualityIcon width={18} height={18} />
        <span>{current}</span>
      </button>
      {open && (
        <div className="playback-overlay__quality-panel">
          <div className="playback-overlay__quality-panel-title">{t('quality.title')}</div>
          <ul className="playback-overlay__quality-list">
            {qualities.map((q, i) => (
              <li
                key={q}
                className={[
                  'playback-overlay__quality-item',
                  i === focusedIndex ? 'playback-overlay__quality-item--focused' : '',
                  q === current ? 'playback-overlay__quality-item--active' : '',
                ].join(' ').trim()}
                onClick={() => onChange(q)}
              >
                <span>{q}</span>
                {q === current && <span className="playback-overlay__quality-check">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
