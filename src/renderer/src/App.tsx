import { useCallback, useEffect, useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import type { AuthStatus } from './types/t4sd'

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AuthStatus | 'loading'>('loading')

  const refresh = useCallback(async () => {
    const s = await window.t4sd.auth.getStatus()
    setStatus(s)
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.t4sd.auth.onEvent((event) => {
      if (event.kind === 'authorized' || event.kind === 'cancelled') void refresh()
    })
    return off
  }, [refresh])

  return (
    <main className="shell">
      <header className="shell__header">
        <h1>Twitch4SteamDeck</h1>
        <span className="shell__version">v{window.t4sd.appVersion}</span>
      </header>
      <section className="shell__body">
        {status === 'loading' && <p>Lade…</p>}
        {status === 'logged-out' && <LoginScreen onAuthorized={refresh} />}
        {status === 'logged-in' && <LoggedInPlaceholder onLogout={refresh} />}
      </section>
    </main>
  )
}

function LoggedInPlaceholder({ onLogout }: { onLogout: () => void }): JSX.Element {
  async function handleLogout(): Promise<void> {
    await window.t4sd.auth.logout()
    onLogout()
  }
  return (
    <div className="login">
      <h2>Eingeloggt</h2>
      <p>Followed-Liste, VODs und Player folgen in den nächsten Schritten.</p>
      <button className="btn" onClick={handleLogout}>
        Abmelden
      </button>
    </div>
  )
}
