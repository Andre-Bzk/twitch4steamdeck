import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './context/SettingsContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </SettingsProvider>
  </React.StrictMode>
)
