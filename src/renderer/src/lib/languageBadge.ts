export const LANG_FLAG: Record<string, string> = {
  en: '🇺🇸',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  pt: '🇧🇷',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇹🇼',
  ru: '🇷🇺',
  it: '🇮🇹',
  pl: '🇵🇱',
  tr: '🇹🇷',
  nl: '🇳🇱',
  sv: '🇸🇪',
  fi: '🇫🇮',
  da: '🇩🇰',
  no: '🇳🇴',
  cs: '🇨🇿',
  hu: '🇭🇺',
  th: '🇹🇭',
  ar: '🇸🇦',
  id: '🇮🇩',
  el: '🇬🇷',
  ro: '🇷🇴',
  bg: '🇧🇬',
  uk: '🇺🇦',
  vi: '🇻🇳',
  he: '🇮🇱',
  sk: '🇸🇰',
  ms: '🇲🇾',
  tl: '🇵🇭',
  hi: '🇮🇳',
  ca: '🇪🇸',
  hr: '🇭🇷',
  sr: '🇷🇸',
  sl: '🇸🇮',
  lt: '🇱🇹',
  lv: '🇱🇻',
  et: '🇪🇪'
}

export function getLanguageFlag(language?: string): string | undefined {
  if (!language) return undefined
  return LANG_FLAG[language.toLowerCase()]
}

export function getLanguageDisplay(language?: string, mode: 'language' | 'flag' | 'both' = 'both'): string | null {
  if (!language || language === 'other' || language === '') return null

  const upper = language.toUpperCase()
  const flag = getLanguageFlag(language)

  if (mode === 'language') return upper
  if (mode === 'flag') return flag ?? upper
  return flag ? `${flag} ${upper}` : upper
}
