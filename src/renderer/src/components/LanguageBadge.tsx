import { useSettings } from '../context/SettingsContext'
import { getLanguageDisplay } from '../lib/languageBadge'

interface Props {
  language?: string
  /** Optional: andere CSS-Klasse für kleinere Karten */
  className?: string
}

export default function LanguageBadge({ language, className = 'card__language' }: Props): JSX.Element | null {
  const { settings } = useSettings()
  const mode = settings.streamBadgeMode

  if (mode === 'off') return null

  const content = getLanguageDisplay(language, mode)
  if (!content) return null

  return <span className={className}>{content}</span>
}
