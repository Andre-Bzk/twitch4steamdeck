import { useEffect, useRef } from 'react'
import { CompassIcon, HeartIcon, SettingsIcon, TwitchGlyphIcon, UserIcon, ChartIcon } from './Icons'
import { getLanguageFlag } from '../lib/languageBadge'
import { useT, type MessageKey } from '../i18n/useT'

export type TabKey =
  | 'following'
  | 'browse'
  | 'topStreamsDe'
  | 'topStreamsEn'
  | 'account'
  | 'settings'

export type SidebarScreen =
  | { kind: 'following' }
  | { kind: 'browse' }
  | { kind: 'stream-list'; titleKey: MessageKey; language: string }
  | { kind: 'account' }
  | { kind: 'settings' }

interface SidebarItemDef {
  key: TabKey
  labelKey: MessageKey
  trailingLabel?: string
  section: 'main' | 'bottom'
  Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element
  screen: SidebarScreen
}

export const SIDEBAR_ITEMS: SidebarItemDef[] = [
  { key: 'following', labelKey: 'nav.following', section: 'main', Icon: HeartIcon, screen: { kind: 'following' } },
  { key: 'browse', labelKey: 'nav.browse', section: 'main', Icon: CompassIcon, screen: { kind: 'browse' } },
  {
    key: 'topStreamsDe',
    labelKey: 'nav.topStreamsDe',
    trailingLabel: getLanguageFlag('de') ?? 'DE',
    section: 'main',
    Icon: ChartIcon,
    screen: { kind: 'stream-list', titleKey: 'nav.topStreamsDe', language: 'de' }
  },
  {
    key: 'topStreamsEn',
    labelKey: 'nav.topStreamsEn',
    trailingLabel: getLanguageFlag('en') ?? 'EN',
    section: 'main',
    Icon: ChartIcon,
    screen: { kind: 'stream-list', titleKey: 'nav.topStreamsEn', language: 'en' }
  },
  { key: 'account', labelKey: 'nav.account', section: 'bottom', Icon: UserIcon, screen: { kind: 'account' } },
  { key: 'settings', labelKey: 'nav.settings', section: 'bottom', Icon: SettingsIcon, screen: { kind: 'settings' } }
]

const MAIN_ITEMS = SIDEBAR_ITEMS.filter((item) => item.section === 'main')
const BOTTOM_ITEMS = SIDEBAR_ITEMS.filter((item) => item.section === 'bottom')

interface Props {
  activeTab: TabKey
  /** -1 when the sidebar does not have focus */
  focusedIndex: number
  onItemClick: (tab: TabKey) => void
}

export default function Sidebar({ activeTab, focusedIndex, onItemClick }: Props): JSX.Element {
  const t = useT()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (focusedIndex >= 0) {
      refs.current[focusedIndex]?.focus({ preventScroll: true })
    }
  }, [focusedIndex])

  return (
    <nav className="sidebar">
      <div className="sidebar__logo">
        <TwitchGlyphIcon aria-hidden="true" />
        <span>Twitch</span>
      </div>
      <div className="sidebar__group">
        <div className="sidebar__items">
          {MAIN_ITEMS.map((item) => renderItem(item))}
        </div>
      </div>
      <div className="sidebar__group sidebar__group--bottom">
        <div className="sidebar__items">
          {BOTTOM_ITEMS.map((item) => renderItem(item))}
        </div>
      </div>
    </nav>
  )

  function renderItem({ key, labelKey, trailingLabel, Icon }: SidebarItemDef): JSX.Element {
    const i = SIDEBAR_ITEMS.findIndex((item) => item.key === key)
    const isActive = key === activeTab
    const isFocused = i === focusedIndex
    const classes = [
      'sidebar__item',
      isActive ? 'sidebar__item--active' : '',
      isFocused ? 'sidebar__item--focused' : ''
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        key={key}
        ref={(el) => {
          refs.current[i] = el
        }}
        className={classes}
        onClick={() => onItemClick(key)}
        tabIndex={isFocused ? 0 : -1}
      >
        <span className="sidebar__item-main">
          <Icon aria-hidden="true" />
          <span className="sidebar__item-label">{t(labelKey)}</span>
          {trailingLabel && <span className="sidebar__item-trailing">{trailingLabel}</span>}
        </span>
      </button>
    )
  }
}
