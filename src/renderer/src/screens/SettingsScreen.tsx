import { useCallback, useEffect, useRef, useState } from 'react'
import { GamepadHintItem, GamepadPrompt } from '../components/GamepadPrompt'
import { SettingsIcon } from '../components/Icons'
import {
  type Language,
  type StreamBadgeMode,
  useSettings,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_DEFAULT,
  BADGE_GAP_MIN,
  BADGE_GAP_MAX,
  BADGE_GAP_DEFAULT,
} from '../context/SettingsContext'
import { useT, type MessageKey } from '../i18n/useT'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
}

interface BadgeOption {
  mode: StreamBadgeMode
  labelKey: MessageKey
  previewKey: MessageKey
}

interface LanguageOption {
  lang: Language
  labelKey: MessageKey
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { lang: 'de', labelKey: 'settings.language.de' },
  { lang: 'en', labelKey: 'settings.language.en' }
]

const OPTIONS: BadgeOption[] = [
  { mode: 'off',      labelKey: 'settings.badge.off',  previewKey: 'settings.badge.previewOff'  },
  { mode: 'language', labelKey: 'settings.badge.lang', previewKey: 'settings.badge.previewLang' },
  { mode: 'flag',     labelKey: 'settings.badge.flag', previewKey: 'settings.badge.previewFlag' },
  { mode: 'both',     labelKey: 'settings.badge.both', previewKey: 'settings.badge.previewBoth' }
]

const SIDEBAR_STEP = 10
const BADGE_GAP_STEP = 2

const MB = 1024 * 1024

function formatCacheSize(bytes: number): string {
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
  const mb = bytes / MB
  if (mb < 1000) return `${mb.toFixed(0)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

/** Row layout: language options → badge options → sidebar/badge sliders → cache toggles/actions → file logging. */
const BADGE_OPTION_OFFSET = LANGUAGE_OPTIONS.length
const SIDEBAR_SLIDER_ROW = BADGE_OPTION_OFFSET + OPTIONS.length
const BADGE_GAP_SLIDER_ROW = SIDEBAR_SLIDER_ROW + 1
const HLS_CACHE_TOGGLE_ROW = BADGE_GAP_SLIDER_ROW + 1
const CACHE_ACTION_ROW = HLS_CACHE_TOGGLE_ROW + 1
const FILE_LOGGING_TOGGLE_ROW = CACHE_ACTION_ROW + 1
const TOTAL_ROWS = FILE_LOGGING_TOGGLE_ROW + 1

export default function SettingsScreen({ hasFocus, onRequestSidebar }: Props): JSX.Element {
  const t = useT()
  const { settings, setStreamBadgeMode, setSidebarWidth, setBadgeGap, setHlsCacheEnabled, setFileLoggingEnabled, setLanguage } = useSettings()
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const langIdx = LANGUAGE_OPTIONS.findIndex((o) => o.lang === settings.language)
    return langIdx >= 0 ? langIdx : 0
  })

  const [cacheSize, setCacheSize] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)

  const refreshCacheSize = useCallback(async (): Promise<void> => {
    try {
      const size = await window.t4sd.app.getCacheSize()
      setCacheSize(size)
    } catch {
      setCacheSize(null)
    }
  }, [])

  useEffect(() => {
    void refreshCacheSize()
  }, [refreshCacheSize])

  const handleClearCache = useCallback(async (): Promise<void> => {
    if (clearing) return
    setClearing(true)
    try {
      await window.t4sd.app.clearCache()
      await refreshCacheSize()
    } finally {
      setClearing(false)
    }
  }, [clearing, refreshCacheSize])

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
          if (focusedIndex < BADGE_OPTION_OFFSET) {
            const opt = LANGUAGE_OPTIONS[focusedIndex]
            if (opt) setLanguage(opt.lang)
          } else if (focusedIndex < SIDEBAR_SLIDER_ROW) {
            const opt = OPTIONS[focusedIndex - BADGE_OPTION_OFFSET]
            if (opt) setStreamBadgeMode(opt.mode)
          } else if (focusedIndex === SIDEBAR_SLIDER_ROW) {
            setSidebarWidth(SIDEBAR_DEFAULT)
          } else if (focusedIndex === BADGE_GAP_SLIDER_ROW) {
            setBadgeGap(BADGE_GAP_DEFAULT)
          } else if (focusedIndex === HLS_CACHE_TOGGLE_ROW) {
            setHlsCacheEnabled(!settings.hlsCacheEnabled)
          } else if (focusedIndex === FILE_LOGGING_TOGGLE_ROW) {
            setFileLoggingEnabled(!settings.fileLoggingEnabled)
          } else if (focusedIndex === CACHE_ACTION_ROW) {
            void handleClearCache()
          }
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, focusedIndex, settings.sidebarWidth, settings.badgeGap, settings.hlsCacheEnabled, settings.fileLoggingEnabled, onRequestSidebar, setStreamBadgeMode, setSidebarWidth, setBadgeGap, setHlsCacheEnabled, setFileLoggingEnabled, setLanguage, handleClearCache])

  const rowRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    if (hasFocus && focusedIndex >= 0) {
      rowRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [hasFocus, focusedIndex])

  const sidebarSliderFocused = hasFocus && focusedIndex === SIDEBAR_SLIDER_ROW
  const badgeGapSliderFocused = hasFocus && focusedIndex === BADGE_GAP_SLIDER_ROW
  const hlsCacheToggleFocused = hasFocus && focusedIndex === HLS_CACHE_TOGGLE_ROW
  const fileLoggingToggleFocused = hasFocus && focusedIndex === FILE_LOGGING_TOGGLE_ROW
  const cacheActionFocused = hasFocus && focusedIndex === CACHE_ACTION_ROW

  return (
    <div className="screen settings-screen">
      <header className="screen__header">
        <h2 className="screen__title">{t('settings.title')}</h2>
      </header>

      <div className="settings-section">
        <h3 className="settings-section__title">{t('settings.language.title')}</h3>
        <p className="settings-section__hint">{t('settings.language.hint')}</p>

        <div className="settings-options">
          {LANGUAGE_OPTIONS.map((opt, i) => {
            const isActive = settings.language === opt.lang
            const isFocused = hasFocus && i === focusedIndex
            return (
              <button
                key={opt.lang}
                ref={(el) => { rowRefs.current[i] = el }}
                className={[
                  'settings-option',
                  isActive ? 'settings-option--active' : '',
                  isFocused ? 'settings-option--focused' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  setFocusedIndex(i)
                  setLanguage(opt.lang)
                }}
                tabIndex={isFocused ? 0 : -1}
              >
                <span className="settings-option__radio" aria-hidden="true">
                  {isActive ? '●' : '○'}
                </span>
                <span className="settings-option__label">{t(opt.labelKey)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">{t('settings.badge.title')}</h3>
        <p className="settings-section__hint">{t('settings.badge.hint')}</p>

        <div className="settings-options">
          {OPTIONS.map((opt, i) => {
            const rowIndex = BADGE_OPTION_OFFSET + i
            const isActive = settings.streamBadgeMode === opt.mode
            const isFocused = hasFocus && rowIndex === focusedIndex
            return (
              <button
                key={opt.mode}
                ref={(el) => { rowRefs.current[rowIndex] = el }}
                className={[
                  'settings-option',
                  isActive ? 'settings-option--active' : '',
                  isFocused ? 'settings-option--focused' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  setFocusedIndex(rowIndex)
                  setStreamBadgeMode(opt.mode)
                }}
                tabIndex={isFocused ? 0 : -1}
              >
                <span className="settings-option__radio" aria-hidden="true">
                  {isActive ? '●' : '○'}
                </span>
                <span className="settings-option__label">{t(opt.labelKey)}</span>
                <span className="settings-option__preview">{t(opt.previewKey)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">{t('settings.sidebar.title')}</h3>
        <p className="settings-section__hint">
          {t('settings.sidebar.hint', { min: SIDEBAR_MIN, max: SIDEBAR_MAX })}
          {' '}
          <span className="gamepad-hint-line">
            <GamepadHintItem prompt={['dpad-left', 'dpad-right']}>{t('settings.adjust')}</GamepadHintItem>
            <span className="gamepad-hint-separator">·</span>
            <span className="gamepad-inline-action">
              <GamepadPrompt prompt="a" />
              <span>{t('settings.resetToDefault', { value: SIDEBAR_DEFAULT })}</span>
            </span>
          </span>
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
        <h3 className="settings-section__title">{t('settings.badgeGap.title')}</h3>
        <p className="settings-section__hint">
          {t('settings.badgeGap.hint', { min: BADGE_GAP_MIN, max: BADGE_GAP_MAX })}
          {' '}
          <span className="gamepad-hint-line">
            <GamepadHintItem prompt={['dpad-left', 'dpad-right']}>{t('settings.adjust')}</GamepadHintItem>
            <span className="gamepad-hint-separator">·</span>
            <span className="gamepad-inline-action">
              <GamepadPrompt prompt="a" />
              <span>{t('settings.resetToDefault', { value: BADGE_GAP_DEFAULT })}</span>
            </span>
          </span>
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
        <h3 className="settings-section__title">{t('settings.storage.title')}</h3>
        <p className="settings-section__hint">{t('settings.storage.hint')}</p>

        <button
          ref={(el) => { rowRefs.current[HLS_CACHE_TOGGLE_ROW] = el }}
          className={[
            'settings-option',
            settings.hlsCacheEnabled ? 'settings-option--active' : '',
            hlsCacheToggleFocused ? 'settings-option--focused' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => {
            setFocusedIndex(HLS_CACHE_TOGGLE_ROW)
            setHlsCacheEnabled(!settings.hlsCacheEnabled)
          }}
          tabIndex={hlsCacheToggleFocused ? 0 : -1}
        >
          <span className="settings-option__radio" aria-hidden="true">
            {settings.hlsCacheEnabled ? '●' : '○'}
          </span>
          <span className="settings-option__label">{t('settings.hlsCache.label')}</span>
          <span className="settings-option__preview">
            {settings.hlsCacheEnabled ? t('settings.hlsCache.on') : t('settings.hlsCache.off')}
          </span>
        </button>

        <button
          ref={(el) => { rowRefs.current[CACHE_ACTION_ROW] = el }}
          className={[
            'settings-cache',
            cacheActionFocused ? 'settings-cache--focused' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => {
            setFocusedIndex(CACHE_ACTION_ROW)
            void handleClearCache()
          }}
          disabled={clearing}
          tabIndex={cacheActionFocused ? 0 : -1}
        >
          <span className="settings-cache__info">
            <span className="settings-cache__size">
              {cacheSize === null ? '…' : formatCacheSize(cacheSize)}
            </span>
          </span>
          <span className="settings-cache__action">
            {clearing ? t('settings.cache.clearing') : t('settings.cache.clear')}
          </span>
        </button>

        <button
          ref={(el) => { rowRefs.current[FILE_LOGGING_TOGGLE_ROW] = el }}
          className={[
            'settings-option',
            settings.fileLoggingEnabled ? 'settings-option--active' : '',
            fileLoggingToggleFocused ? 'settings-option--focused' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => {
            setFocusedIndex(FILE_LOGGING_TOGGLE_ROW)
            setFileLoggingEnabled(!settings.fileLoggingEnabled)
          }}
          tabIndex={fileLoggingToggleFocused ? 0 : -1}
        >
          <span className="settings-option__radio" aria-hidden="true">
            {settings.fileLoggingEnabled ? '●' : '○'}
          </span>
          <span className="settings-option__label">{t('settings.fileLog.label')}</span>
          <span className="settings-option__preview">
            {settings.fileLoggingEnabled ? t('settings.fileLog.on') : t('settings.fileLog.off')}
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
