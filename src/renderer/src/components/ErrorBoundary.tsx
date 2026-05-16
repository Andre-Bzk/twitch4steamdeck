import { Component, type ErrorInfo, type ReactNode } from 'react'
import log from 'electron-log/renderer'
import { tStatic } from '../i18n/useT'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error('[error-boundary]', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0e0e10',
          color: '#efeff1',
          gap: 16,
          padding: 32,
          fontFamily: 'sans-serif'
        }}>
          <div style={{ fontSize: 24, color: '#ff6b6b' }}>{tStatic('app.error.title')}</div>
          <pre style={{ fontSize: 12, color: '#adadb8', maxWidth: 640, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{
              padding: '10px 24px',
              background: '#9147ff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            {tStatic('app.error.reload')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
