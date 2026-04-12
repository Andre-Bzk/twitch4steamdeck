import { useEffect, useRef, useState } from 'react'
import { SettingsIcon } from '../components/Icons'
import {
  type StreamBadgeMode,
  useSettings,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_DEFAULT,
  BADGE_GAP_MIN,
  BADGE_GAP_MAX,
  BADGE_GAP_DEFAULT
} from '../context/SettingsContext'

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

const SIDEBAR_STEP = 10
const BADGE_GAP_STEP = 2

/** Total focusable rows: badge options + sidebar slider + badge gap slider + logging toggle */
const SIDEBAR_SLIDER_ROW = OPTIONS.length
const BADGE_GAP_SLIDER_ROW = OPTIONS.length + 1
const LOGGING_TOGGLE_ROW = OPTIONS.length + 2
const TOTAL_ROWS = OPTIONS.length + 3

export default function SettingsScreen({ hasFocus, onRequestSidebar }: Props): JSX.Element {
  const { settings, setStreamBadgeMode, setSidebarWidth, setBadgeGap, setMpvLoggingEnabled } = useSettings()
  const [logPath, setLogPath] = useState('/home/deck/.var/app/tv.twitch4steamdeck.App/config/Electron/mpv.log')
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(0, OPTIONS.findIndex((o) => o.mode === settings.streamBadgeMode))
  )

  useEffect(() => {
    void window.t4sd.playback.getLogPath().then(setLogPath).catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasFocus) return
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onRequestSidebar()
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(0, i - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(TOTAL_ROWS - 1, i + 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (focusedIndex === SIDEBAR_SLIDER_ROW) {
            setSidebarWidth(settings.sidebarWidth - SIDEBAR_STEP)
          } else if (focusedIndex === BADGE_GAP_SLIDER_ROW) {
            setBadgeGap(settings.badgeGap - BADGE_GAP_STEP)
          } else {
            onRequestSidebar()
          }
          break
        case 'ArrowRight':
          if (focusedIndex === SIDEBAR_SLIDER_ROW) {
            e.preventDefault()
            setSidebarWidth(settings.sidebarWidth + SIDEBAR_STEP)
          } else if (focusedIndex === BADGE_GAP_SLIDER_ROW) {
            e.preventDefault()
            setBadgeGap(settings.badgeGap + BADGE_GAP_STEP)
          }
          break
        case 'Enter': {
          e.preventDefault()
          if (focusedIndex < OPTIONS.length) {
            const opt = OPTIONS[focusedIndex]
            if (opt) setStreamBadgeMode(opt.mode)
          } else if (focusedIndex === SIDEBAR_SLIDER_ROW) {
            setSidebarWidth(SIDEBAR_DEFAULT)
          } else if (focusedIndex === BADGE_GAP_SLIDER_ROW) {
            setBadgeGap(BADGE_GAP_DEFAULT)
          } else if (focusedIndex === LOGGING_TOGGLE_ROW) {
            setMpvLoggingEnabled(!settings.mpvLoggingEnabled)
          }
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, focusedIndex, settings.sidebarWidth, settings.badgeGap, settings.mpvLoggingEnabled, onRequestSidebar, setStreamBadgeMode, setSidebarWidth, setBadgeGap, setMpvLoggingEnabled])

  const rowRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    if (hasFocus && focusedIndex >= 0) {
      rowRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [hasFocus, focusedIndex])

  const sidebarSliderFocused = hasFocus && focusedIndex === SIDEBAR_SLIDER_ROW
  const badgeGapSliderFocused = hasFocus && focusedIndex === BADGE_GAP_SLIDER_ROW
  const loggingToggleFocused = hasFocus && focusedIndex === LOGGING_TOGGLE_ROW

  return (
    <div className="screen settings-screen">
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
                ref={(el) => { rowRefs.current[i] = el }}
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

      <div className="settings-section">
        <h3 className="settings-section__title">Sidebar-Breite</h3>
        <p className="settings-section__hint">
          Breite der Seitenleiste anpassen ({SIDEBAR_MIN}–{SIDEBAR_MAX} px).
          Mit Links/Rechts verschieben, Enter setzt auf Standard ({SIDEBAR_DEFAULT} px) zurück.
        </p>

        <div
          ref={(el) => { rowRefs.current[SIDEBAR_SLIDER_ROW] = el }}
          className={[
            'settings-slider',
            sidebarSliderFocused ? 'settings-slider--focused' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => setFocusedIndex(SIDEBAR_SLIDER_ROW)}
        >
          <input
            type="range"
            className="settings-slider__input"
            min={SIDEBAR_MIN}
            max={SIDEBAR_MAX}
            step={SIDEBAR_STEP}
            value={settings.sidebarWidth}
            onChange={(e) => setSidebarWidth(Number(e.target.value))}
            tabIndex={sidebarSliderFocused ? 0 : -1}
          />
          <span className="settings-slider__value">{settings.sidebarWidth} px</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">Flaggen-Badge Abstand</h3>
        <p className="settings-section__hint">
          Abstand zwischen Menütext und Flaggen-Badge ({BADGE_GAP_MIN}–{BADGE_GAP_MAX} px).
          Mit Links/Rechts verschieben, Enter setzt auf Standard ({BADGE_GAP_DEFAULT} px) zurück.
        </p>

        <div
          ref={(el) => { rowRefs.current[BADGE_GAP_SLIDER_ROW] = el }}
          className={[
            'settings-slider',
            badgeGapSliderFocused ? 'settings-slider--focused' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => setFocusedIndex(BADGE_GAP_SLIDER_ROW)}
        >
          <input
            type="range"
            className="settings-slider__input"
            min={BADGE_GAP_MIN}
            max={BADGE_GAP_MAX}
            step={BADGE_GAP_STEP}
            value={settings.badgeGap}
            onChange={(e) => setBadgeGap(Number(e.target.value))}
            tabIndex={badgeGapSliderFocused ? 0 : -1}
          />
          <span className="settings-slider__value">{settings.badgeGap} px</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">mpv-Logging</h3>
        <p className="settings-section__hint">
          Aktiviert oder deaktiviert die mpv-Logdatei für Diagnosezwecke.
          Logpfad auf dem Steam Deck: <code>{logPath}</code>
        </p>

        <button
          ref={(el) => { rowRefs.current[LOGGING_TOGGLE_ROW] = el }}
          className={[
            'settings-option',
            settings.mpvLoggingEnabled ? 'settings-option--active' : '',
            loggingToggleFocused ? 'settings-option--focused' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => {
            setFocusedIndex(LOGGING_TOGGLE_ROW)
            setMpvLoggingEnabled(!settings.mpvLoggingEnabled)
          }}
          tabIndex={loggingToggleFocused ? 0 : -1}
        >
          <span className="settings-option__radio" aria-hidden="true">
            {settings.mpvLoggingEnabled ? '●' : '○'}
          </span>
          <span className="settings-option__label">
            {settings.mpvLoggingEnabled ? 'Logging aktiviert' : 'Logging deaktiviert'}
          </span>
          <span className="settings-option__preview">
            {settings.mpvLoggingEnabled ? 'mpv schreibt in mpv.log' : 'keine neue mpv.log wird geschrieben'}
          </span>
        </button>
      </div>

      {!hasFocus && (
        <div className="screen__state" style={{ flex: 0 }}>
          <SettingsIcon style={{ width: 48, height: 48, opacity: 0.2 }} />
        </div>
      )}
    </div>
  )
}
