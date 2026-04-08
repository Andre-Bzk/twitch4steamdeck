import { createContext, useCallback, useContext, useState } from 'react'

export type StreamBadgeMode = 'off' | 'language' | 'flag' | 'both'

export interface AppSettings {
  streamBadgeMode: StreamBadgeMode
}

const STORAGE_KEY = 't4sd:settings'
const DEFAULTS: AppSettings = { streamBadgeMode: 'language' }

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const modes: StreamBadgeMode[] = ['off', 'language', 'flag', 'both']
    return {
      streamBadgeMode: modes.includes(parsed.streamBadgeMode as StreamBadgeMode)
        ? (parsed.streamBadgeMode as StreamBadgeMode)
        : DEFAULTS.streamBadgeMode
    }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // localStorage nicht verfügbar — ignorieren
  }
}

interface SettingsCtx {
  settings: AppSettings
  setStreamBadgeMode: (mode: StreamBadgeMode) => void
}

const SettingsContext = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  const setStreamBadgeMode = useCallback((mode: StreamBadgeMode) => {
    setSettings((prev) => {
      const next = { ...prev, streamBadgeMode: mode }
      saveSettings(next)
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, setStreamBadgeMode }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
