import { useSettings } from '../context/SettingsContext'

// Pragmatische Sprache→Flagge-Zuordnung.
// Grundsatz: dominante Twitch-Nutzerbase pro Sprache,
// nicht die politisch "erste" Assoziation.
const LANG_FLAG: Record<string, string> = {
  en: '🇺🇸',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  pt: '🇧🇷', // Brasilien dominiert pt auf Twitch
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇹🇼', // Taiwan dominiert zh auf Twitch
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

interface Props {
  language?: string
  /** Optional: andere CSS-Klasse für kleinere Karten */
  className?: string
}

export default function LanguageBadge({ language, className = 'card__language' }: Props): JSX.Element | null {
  const { settings } = useSettings()
  const mode = settings.streamBadgeMode

  if (mode === 'off' || !language || language === 'other' || language === '') return null

  const upper = language.toUpperCase()
  const flag = LANG_FLAG[language.toLowerCase()]

  let content: string
  if (mode === 'language') {
    content = upper
  } else if (mode === 'flag') {
    content = flag ?? upper // Fallback auf Kürzel wenn keine Flagge bekannt
  } else {
    // 'both'
    content = flag ? `${flag} ${upper}` : upper
  }

  return <span className={className}>{content}</span>
}
