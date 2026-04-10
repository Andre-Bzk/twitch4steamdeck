import { useCallback, useEffect, useState } from 'react'
import { gamepadService } from './input/gamepad'
import AppShell from './screens/AppShell'
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

  // Browser Gamepad API (funktioniert im Desktop-Modus / Windows)
  useEffect(() => {
    gamepadService.start()
    return () => gamepadService.stop()
  }, [])

  // Main-Process Gamepad Reader (liest /dev/input/js* direkt, funktioniert in Gaming Mode)
  useEffect(() => {
    return window.t4sd.gamepad.onInput((key) => {
      const target = document.activeElement ?? document.body
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }, [])

  if (status === 'loading') {
    return (
      <div className="fullscreen-center">
        <p>Lade…</p>
      </div>
    )
  }

  if (status === 'logged-out') {
    return (
      <main className="shell">
        <LoginScreen onAuthorized={refresh} />
      </main>
    )
  }

  return <AppShell onLogout={refresh} />
}
