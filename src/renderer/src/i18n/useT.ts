// Translation hook. Reads the active language from SettingsContext and returns
// a `t(key, vars?)` lookup function. Supports `{name}` placeholders that get
// substituted from the optional `vars` object.
import { useCallback } from 'react'
import { useSettings, type Language } from '../context/SettingsContext'
import { de, type MessageKey, type Messages } from './de'
import { en } from './en'

const TABLES: Record<Language, Messages> = { de, en }

export type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string

function interpolate(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const v = vars[name]
    return v === undefined ? `{${name}}` : String(v)
  })
}

export function useT(): TranslateFn {
  const { settings } = useSettings()
  const table = TABLES[settings.language] ?? de
  return useCallback((key: MessageKey, vars?: Record<string, string | number>): string =>
    interpolate(table[key], vars), [table])
}

// Reads the active language directly from localStorage. Use in non-React
// contexts (class components, error boundaries, modules) where useT() is not
// available. Falls back to 'de' if storage is unavailable or invalid.
export function getActiveLanguage(): Language {
  try {
    const raw = localStorage.getItem('t4sd:settings')
    if (raw) {
      const parsed = JSON.parse(raw) as { language?: unknown }
      if (parsed.language === 'en' || parsed.language === 'de') return parsed.language
    }
  } catch { /* ignore */ }
  return 'de'
}

export function tStatic(key: MessageKey, vars?: Record<string, string | number>): string {
  const table = TABLES[getActiveLanguage()] ?? de
  return interpolate(table[key], vars)
}

export type { MessageKey }
