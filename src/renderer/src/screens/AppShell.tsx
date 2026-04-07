import { useCallback, useEffect, useState } from 'react'
import Sidebar, { SIDEBAR_ITEMS, type TabKey } from '../components/Sidebar'
import AccountScreen from './AccountScreen'
import BrowseScreen from './BrowseScreen'
import FollowingScreen from './FollowingScreen'

type Region = 'sidebar' | 'main'

interface Props {
  onLogout: () => void
}

export default function AppShell({ onLogout }: Props): JSX.Element {
  const [tab, setTab] = useState<TabKey>('following')
  const [region, setRegion] = useState<Region>('main')
  const [sidebarIndex, setSidebarIndex] = useState(0)

  const requestSidebar = useCallback(() => {
    const idx = SIDEBAR_ITEMS.findIndex((t) => t.key === tab)
    setSidebarIndex(idx >= 0 ? idx : 0)
    setRegion('sidebar')
  }, [tab])

  // Key-Handler für die Sidebar (wenn sie den Fokus hat)
  useEffect(() => {
    if (region !== 'sidebar') return
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSidebarIndex((i) => Math.max(0, i - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setSidebarIndex((i) => Math.min(SIDEBAR_ITEMS.length - 1, i + 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setRegion('main')
          break
        case 'Enter':
          e.preventDefault()
          setTab(SIDEBAR_ITEMS[sidebarIndex].key)
          setRegion('main')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [region, sidebarIndex])

  const mainFocus = region === 'main'

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={tab}
        focusedIndex={region === 'sidebar' ? sidebarIndex : -1}
        onItemClick={(k) => {
          setTab(k)
          setRegion('main')
        }}
      />
      <div className="main-content">
        {tab === 'following' && (
          <FollowingScreen hasFocus={mainFocus} onRequestSidebar={requestSidebar} />
        )}
        {tab === 'browse' && (
          <BrowseScreen hasFocus={mainFocus} onRequestSidebar={requestSidebar} />
        )}
        {tab === 'account' && (
          <AccountScreen
            hasFocus={mainFocus}
            onRequestSidebar={requestSidebar}
            onLogout={onLogout}
          />
        )}
      </div>
    </div>
  )
}
