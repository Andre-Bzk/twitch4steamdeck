import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { DeviceFlowStartInfo } from '../types/t4sd'

interface Props {
  onAuthorized: () => void
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'awaiting'; info: DeviceFlowStartInfo; qrDataUrl: string; remainingSec: number }
  | { kind: 'error'; message: string }
  | { kind: 'not-configured' }

export default function LoginScreen({ onAuthorized }: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const startBtnRef = useRef<HTMLButtonElement>(null)

  // On mount: check whether the client ID is configured.
  useEffect(() => {
    void window.t4sd.auth.isConfigured().then((ok) => {
      if (!ok) setPhase({ kind: 'not-configured' })
    })
    startBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter') return
      if (phase.kind === 'idle' || phase.kind === 'error') void start()
      else if (phase.kind === 'awaiting') void cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  // Subscribe to auth events from the main process.
  useEffect(() => {
    const off = window.t4sd.auth.onEvent((event) => {
      switch (event.kind) {
        case 'authorized':
          onAuthorized()
          break
        case 'denied':
          setPhase({ kind: 'error', message: 'Zugriff abgelehnt.' })
          break
        case 'expired':
          setPhase({ kind: 'error', message: 'Code abgelaufen — bitte erneut versuchen.' })
          break
        case 'error':
          setPhase({ kind: 'error', message: event.message })
          break
        case 'cancelled':
          setPhase({ kind: 'idle' })
          break
      }
    })
    return off
  }, [onAuthorized])

  // Countdown tick for the awaiting phase.
  useEffect(() => {
    if (phase.kind !== 'awaiting') return
    if (phase.remainingSec <= 0) return
    const t = setTimeout(() => {
      setPhase((p) =>
        p.kind === 'awaiting' ? { ...p, remainingSec: p.remainingSec - 1 } : p
      )
    }, 1000)
    return () => clearTimeout(t)
  }, [phase])

  async function start(): Promise<void> {
    setPhase({ kind: 'starting' })
    try {
      const info = await window.t4sd.auth.startDeviceFlow()
      const qrDataUrl = await QRCode.toDataURL(info.verificationUri, {
        margin: 1,
        width: 280,
        color: { dark: '#0e0e10', light: '#ffffff' }
      })
      setPhase({ kind: 'awaiting', info, qrDataUrl, remainingSec: info.expiresInSec })
    } catch (err) {
      setPhase({ kind: 'error', message: (err as Error).message })
    }
  }

  async function cancel(): Promise<void> {
    await window.t4sd.auth.cancel()
    setPhase({ kind: 'idle' })
  }

  if (phase.kind === 'not-configured') {
    return (
      <div className="login">
        <h2>Konfiguration fehlt</h2>
        <p>
          Es ist keine Twitch <code>Client ID</code> hinterlegt. Lege im Projektverzeichnis eine
          Datei <code>.env</code> an (siehe <code>.env.example</code>) und setze
          <br />
          <code>MAIN_VITE_TWITCH_CLIENT_ID=…</code>
          <br />
          Danach <code>npm run dev</code> neu starten.
        </p>
      </div>
    )
  }

  if (phase.kind === 'awaiting') {
    return (
      <div className="login">
        <h2>Mit Twitch verbinden</h2>
        <p>
          Öffne auf einem anderen Gerät{' '}
          <strong>{phase.info.verificationUri}</strong> und gib den Code ein:
        </p>
        <div className="login__code">{phase.info.userCode}</div>
        <img className="login__qr" src={phase.qrDataUrl} alt="QR Code" />
        <p className="login__hint">Code läuft in {formatTime(phase.remainingSec)} ab.</p>
        <button className="btn" onClick={cancel}>
          Abbrechen
        </button>
      </div>
    )
  }

  return (
    <div className="login">
      <h2>Willkommen</h2>
      <p>Verbinde deinen Twitch-Account, um gefolgte Kanäle und VODs zu sehen.</p>
      {phase.kind === 'error' && <p className="login__error">{phase.message}</p>}
      <button
        ref={startBtnRef}
        className="btn btn--primary"
        onClick={start}
        disabled={phase.kind === 'starting'}
      >
        {phase.kind === 'starting' ? 'Starte…' : 'Mit Twitch verbinden'}
      </button>
    </div>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
