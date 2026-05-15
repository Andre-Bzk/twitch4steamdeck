import { useEffect, useRef, useState } from 'react'
import { UserIcon } from '../components/Icons'
import type { OwnUserInfo } from '../types/t4sd'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
  onLogout: () => void
}

export default function AccountScreen({ hasFocus, onRequestSidebar, onLogout }: Props): JSX.Element {
  const logoutBtnRef = useRef<HTMLButtonElement>(null)
  const [user, setUser] = useState<OwnUserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [confirmIndex, setConfirmIndex] = useState(0) // 0 = Nein, 1 = Ja

  useEffect(() => {
    if (hasFocus && !confirmVisible) logoutBtnRef.current?.focus({ preventScroll: true })
  }, [hasFocus, confirmVisible])

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    setError('')

    void window.t4sd.twitch
      .getOwnUser()
      .then((nextUser) => {
        if (!cancelled) setUser(nextUser)
      })
      .catch((err) => {
        if (!cancelled) {
          setUser(null)
          setError(err instanceof Error ? err.message : 'Accountdaten konnten nicht geladen werden.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasFocus) return
    const onKey = (e: KeyboardEvent): void => {
      if (confirmVisible) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setConfirmIndex(0)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setConfirmIndex(1)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setConfirmVisible(false)
          setConfirmIndex(0)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          if (confirmIndex === 1) {
            void handleLogout()
          } else {
            setConfirmVisible(false)
            setConfirmIndex(0)
          }
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault()
        onRequestSidebar()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        setConfirmVisible(true)
        setConfirmIndex(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasFocus, confirmVisible, confirmIndex, onRequestSidebar])

  async function handleLogout(): Promise<void> {
    await window.t4sd.auth.logout()
    onLogout()
  }

  const showLogin = user && user.login.toLowerCase() !== user.displayName.toLowerCase()

  return (
    <div className="screen">
      <header className="screen__header">
        <h2 className="screen__title">Mein Account</h2>
      </header>
      <div className="account">
        <div className="account__avatar">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" draggable={false} />
          ) : (
            <UserIcon />
          )}
        </div>
        <div className="account__identity">
          <p className="account__hint">Eingeloggt bei Twitch</p>
          {isLoading ? (
            <p className="account__name">Lade Account…</p>
          ) : user ? (
            <>
              <p className="account__name">{user.displayName}</p>
              {showLogin && <p className="account__login">@{user.login}</p>}
            </>
          ) : (
            <p className="account__error">{error || 'Accountdaten konnten nicht geladen werden.'}</p>
          )}
        </div>
        <p className="account__version">App-Version {window.t4sd.appVersion}</p>
        {confirmVisible ? (
          <div className="account__confirm">
            <p className="account__confirm-text">Wirklich abmelden?</p>
            <div className="account__confirm-buttons">
              <button
                className={['btn', confirmIndex === 0 ? 'btn--focused' : ''].filter(Boolean).join(' ')}
                onClick={() => { setConfirmVisible(false); setConfirmIndex(0) }}
              >
                Nein
              </button>
              <button
                className={['btn', confirmIndex === 1 ? 'btn--focused' : ''].filter(Boolean).join(' ')}
                onClick={() => { void handleLogout() }}
              >
                Ja
              </button>
            </div>
          </div>
        ) : (
          <button ref={logoutBtnRef} className="btn" onClick={() => { setConfirmVisible(true); setConfirmIndex(0) }}>
            Abmelden
          </button>
        )}
      </div>
    </div>
  )
}
