import { useEffect, useState } from 'react'
import { SettingsIcon } from '../components/Icons'
import { type StreamBadgeMode, useSettings } from '../context/SettingsContext'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
}

interface Option {
  mode: StreamBadgeMode
  label: string
  preview: string
}

const OPTIONS: Option[] = [
  { mode: 'off',      label: 'Aus',                       preview: '— kein Badge' },
  { mode: 'language', label: 'Nur Sprach-Kürzel',         preview: 'z.B.  DE  EN  PT' },
  { mode: 'flag',     label: 'Nur Flagge',                preview: 'z.B.  🇩🇪  🇺🇸  🇧🇷' },
  { mode: 'both',     label: 'Beides (Flagge + Kürzel)',  preview: 'z.B.  🇩🇪 DE  🇺🇸 EN' }
]

export default function SettingsScreen({ hasFocus, onRequestSidebar }: Props): JSX.Element {
  const { settings, setStreamBadgeMode } = useSettings()
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(0, OPTIONS.findIndex((o) => o.mode === settings.streamBadgeMode))
  )

  useEffect(() => {
    if (!hasFocus) return
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(0, i - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(OPTIONS.length - 1, i + 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          onRequestSidebar()
          break
        case 'Enter': {
          e.preventDefault()
          const opt = OPTIONS[focusedIndex]
          if (opt) setStreamBadgeMode(opt.mode)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, focusedIndex, onRequestSidebar, setStreamBadgeMode])

  return (
    <div className="screen">
      <header className="screen__header">
        <h2 className="screen__title">Einstellungen</h2>
      </header>

      <div className="settings-section">
        <h3 className="settings-section__title">Sprach-Anzeige auf Stream-Karten</h3>
        <p className="settings-section__hint">
          Twitch liefert nur die Stream-Sprache — kein Land. Flaggen-Zuordnung
          ist eine Annäherung basierend auf der dominanten Twitch-Nutzerbase
          (z.B. Portugiesisch → 🇧🇷 Brasilien).
        </p>

        <div className="settings-options">
          {OPTIONS.map((opt, i) => {
            const isActive = settings.streamBadgeMode === opt.mode
            const isFocused = hasFocus && i === focusedIndex
            return (
              <button
                key={opt.mode}
                className={[
                  'settings-option',
                  isActive ? 'settings-option--active' : '',
                  isFocused ? 'settings-option--focused' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  setFocusedIndex(i)
                  setStreamBadgeMode(opt.mode)
                }}
                tabIndex={isFocused ? 0 : -1}
              >
                <span className="settings-option__radio" aria-hidden="true">
                  {isActive ? '●' : '○'}
                </span>
                <span className="settings-option__label">{opt.label}</span>
                <span className="settings-option__preview">{opt.preview}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!hasFocus && (
        <div className="screen__state" style={{ flex: 0 }}>
          <SettingsIcon style={{ width: 48, height: 48, opacity: 0.2 }} />
        </div>
      )}
    </div>
  )
}
