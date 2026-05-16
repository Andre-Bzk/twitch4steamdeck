import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type StreamBadgeMode = 'off' | 'language' | 'flag' | 'both'
export type Language = 'de' | 'en'

export interface AppSettings {
  streamBadgeMode: StreamBadgeMode
  sidebarWidth: number
  badgeGap: number
  hlsCacheEnabled: boolean
  fileLoggingEnabled: boolean
  language: Language
}

const STORAGE_KEY = 't4sd:settings'
const SIDEBAR_MIN = 240
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 270
const BADGE_GAP_MIN = 0
const BADGE_GAP_MAX = 20
const BADGE_GAP_DEFAULT = 6
const DEFAULTS: AppSettings = {
  streamBadgeMode: 'both',
  sidebarWidth: SIDEBAR_DEFAULT,
  badgeGap: BADGE_GAP_DEFAULT,
  hlsCacheEnabled: false,
  fileLoggingEnabled: false,
  language: 'en'
}

export { SIDEBAR_MIN, SIDEBAR_MAX, SIDEBAR_DEFAULT, BADGE_GAP_MIN, BADGE_GAP_MAX, BADGE_GAP_DEFAULT }

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const modes: StreamBadgeMode[] = ['off', 'language', 'flag', 'both']
    const languages: Language[] = ['de', 'en']
    const sw = Number(parsed.sidebarWidth)
    const bg = Number(parsed.badgeGap)
    return {
      streamBadgeMode: modes.includes(parsed.streamBadgeMode as StreamBadgeMode)
        ? (parsed.streamBadgeMode as StreamBadgeMode)
        : DEFAULTS.streamBadgeMode,
      sidebarWidth: sw >= SIDEBAR_MIN && sw <= SIDEBAR_MAX ? sw : SIDEBAR_DEFAULT,
      badgeGap: bg >= BADGE_GAP_MIN && bg <= BADGE_GAP_MAX ? bg : BADGE_GAP_DEFAULT,
      hlsCacheEnabled: typeof parsed.hlsCacheEnabled === 'boolean' ? parsed.hlsCacheEnabled : DEFAULTS.hlsCacheEnabled,
      fileLoggingEnabled: typeof parsed.fileLoggingEnabled === 'boolean' ? parsed.fileLoggingEnabled : DEFAULTS.fileLoggingEnabled,
      language: languages.includes(parsed.language as Language)
        ? (parsed.language as Language)
        : DEFAULTS.language
    }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // localStorage not available — ignore
  }
}

interface SettingsCtx {
  settings: AppSettings
  setStreamBadgeMode: (mode: StreamBadgeMode) => void
  setSidebarWidth: (width: number) => void
  setBadgeGap: (gap: number) => void
  setHlsCacheEnabled: (enabled: boolean) => void
  setFileLoggingEnabled: (enabled: boolean) => void
  setLanguage: (language: Language) => void
}

const SettingsContext = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`)
    document.documentElement.style.setProperty('--badge-gap', `${settings.badgeGap}px`)
    void window.t4sd.app.setHlsCacheEnabled(settings.hlsCacheEnabled)
    void window.t4sd.app.setFileLoggingEnabled(settings.fileLoggingEnabled)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setStreamBadgeMode = useCallback((mode: StreamBadgeMode) => {
    setSettings((prev) => {
      const next = { ...prev, streamBadgeMode: mode }
      saveSettings(next)
      return next
    })
  }, [])

  const setSidebarWidth = useCallback((width: number) => {
    const clamped = Math.round(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, width)))
    setSettings((prev) => {
      const next = { ...prev, sidebarWidth: clamped }
      saveSettings(next)
      return next
    })
    document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`)
  }, [])

  const setBadgeGap = useCallback((gap: number) => {
    const clamped = Math.round(Math.max(BADGE_GAP_MIN, Math.min(BADGE_GAP_MAX, gap)))
    setSettings((prev) => {
      const next = { ...prev, badgeGap: clamped }
      saveSettings(next)
      return next
    })
    document.documentElement.style.setProperty('--badge-gap', `${clamped}px`)
  }, [])

  const setHlsCacheEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, hlsCacheEnabled: enabled }
      saveSettings(next)
      return next
    })
    void window.t4sd.app.setHlsCacheEnabled(enabled)
  }, [])

  const setFileLoggingEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, fileLoggingEnabled: enabled }
      saveSettings(next)
      return next
    })
    void window.t4sd.app.setFileLoggingEnabled(enabled)
  }, [])

  const setLanguage = useCallback((language: Language) => {
    setSettings((prev) => {
      const next = { ...prev, language }
      saveSettings(next)
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, setStreamBadgeMode, setSidebarWidth, setBadgeGap, setHlsCacheEnabled, setFileLoggingEnabled, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
