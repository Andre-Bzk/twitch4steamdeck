import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { DeviceFlowStartInfo } from '../types/t4sd'
import { useT } from '../i18n/useT'
import { useSettings } from '../context/SettingsContext'

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
  const t = useT()
  const { settings, setLanguage } = useSettings()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const startBtnRef = useRef<HTMLButtonElement>(null)
  const langEnRef = useRef<HTMLButtonElement>(null)
  const langDeRef = useRef<HTMLButtonElement>(null)

  // On mount: check whether the client ID is configured.
  useEffect(() => {
    void window.t4sd.auth.isConfigured().then((ok) => {
      if (!ok) setPhase({ kind: 'not-configured' })
    })
    startBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const active = document.activeElement
      if (e.key === 'ArrowRight' && active === langEnRef.current) {
        langDeRef.current?.focus()
      } else if (e.key === 'ArrowLeft' && active === langDeRef.current) {
        langEnRef.current?.focus()
      } else if (e.key === 'ArrowDown' && active === startBtnRef.current) {
        langEnRef.current?.focus()
      } else if (e.key === 'ArrowUp' && (active === langEnRef.current || active === langDeRef.current)) {
        startBtnRef.current?.focus()
      } else if (e.key === 'Enter') {
        if (active === langEnRef.current) { setLanguage('en'); return }
        if (active === langDeRef.current) { setLanguage('de'); return }
        if (phase.kind === 'idle' || phase.kind === 'error') void start()
        else if (phase.kind === 'awaiting') void cancel()
      }
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
          setPhase({ kind: 'error', message: t('login.error.accessDenied') })
          break
        case 'expired':
          setPhase({ kind: 'error', message: t('login.error.expired') })
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
        <h2>{t('login.notConfigured.title')}</h2>
        <p>{t('login.notConfigured.body')}</p>
        <p>{t('login.notConfigured.restart')}</p>
      </div>
    )
  }

  if (phase.kind === 'awaiting') {
    return (
      <div className="login">
        <h2>{t('login.connect')}</h2>
        <p>
          {t('login.openOnDevice')}{' '}
          <strong>{phase.info.verificationUri}</strong> {t('login.enterCode')}
        </p>
        <div className="login__code">{phase.info.userCode}</div>
        <img className="login__qr" src={phase.qrDataUrl} alt="QR Code" />
        <p className="login__hint">{t('login.expiresIn', { time: formatTime(phase.remainingSec) })}</p>
        <button className="btn" onClick={cancel}>
          {t('common.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="login">
      <h2>{t('login.welcome')}</h2>
      <p>{t('login.intro')}</p>
      {phase.kind === 'error' && <p className="login__error">{phase.message}</p>}
      <button
        ref={startBtnRef}
        className="btn btn--primary"
        onClick={start}
        disabled={phase.kind === 'starting'}
      >
        {phase.kind === 'starting' ? t('login.starting') : t('login.connect')}
      </button>
      <div className="login__lang-select">
        <span className="login__lang-label">{t('login.languageSelect')}</span>
        <div className="login__lang-buttons">
          <button
            ref={langEnRef}
            className={`login__lang-btn${settings.language === 'en' ? ' login__lang-btn--active' : ''}`}
            onClick={() => setLanguage('en')}
            aria-label="English"
          >
            🇺🇸
          </button>
          <button
            ref={langDeRef}
            className={`login__lang-btn${settings.language === 'de' ? ' login__lang-btn--active' : ''}`}
            onClick={() => setLanguage('de')}
            aria-label="Deutsch"
          >
            🇩🇪
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
