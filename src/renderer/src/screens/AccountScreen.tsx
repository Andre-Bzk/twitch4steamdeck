import { useEffect, useRef } from 'react'
import { UserIcon } from '../components/Icons'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
  onLogout: () => void
}

export default function AccountScreen({ hasFocus, onRequestSidebar, onLogout }: Props): JSX.Element {
  const logoutBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (hasFocus) logoutBtnRef.current?.focus({ preventScroll: true })
  }, [hasFocus])

  useEffect(() => {
    if (!hasFocus) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onRequestSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, onRequestSidebar])

  async function handleLogout(): Promise<void> {
    await window.t4sd.auth.logout()
    onLogout()
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h2 className="screen__title">Mein Account</h2>
      </header>
      <div className="account">
        <div className="account__avatar">
          <UserIcon />
        </div>
        <p className="account__hint">Eingeloggt bei Twitch</p>
        <p className="account__version">App-Version {window.t4sd.appVersion}</p>
        <button ref={logoutBtnRef} className="btn" onClick={handleLogout}>
          Abmelden
        </button>
      </div>
    </div>
  )
}
