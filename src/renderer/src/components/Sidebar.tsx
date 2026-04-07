import { useEffect, useRef } from 'react'
import { CompassIcon, HeartIcon, UserIcon } from './Icons'

export type TabKey = 'following' | 'browse' | 'account'

interface SidebarItemDef {
  key: TabKey
  label: string
  Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element
}

export const SIDEBAR_ITEMS: SidebarItemDef[] = [
  { key: 'following', label: 'Du folgst', Icon: HeartIcon },
  { key: 'browse', label: 'Durchsuchen', Icon: CompassIcon },
  { key: 'account', label: 'Mein Account', Icon: UserIcon }
]

interface Props {
  activeTab: TabKey
  /** -1 wenn Sidebar nicht den Fokus hat */
  focusedIndex: number
  onItemClick: (tab: TabKey) => void
}

export default function Sidebar({ activeTab, focusedIndex, onItemClick }: Props): JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (focusedIndex >= 0) {
      refs.current[focusedIndex]?.focus({ preventScroll: true })
    }
  }, [focusedIndex])

  return (
    <nav className="sidebar">
      <div className="sidebar__logo">Twitch4SteamDeck</div>
      <div className="sidebar__items">
        {SIDEBAR_ITEMS.map(({ key, label, Icon }, i) => {
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
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
