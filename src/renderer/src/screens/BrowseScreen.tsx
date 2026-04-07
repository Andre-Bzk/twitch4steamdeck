import { useEffect } from 'react'
import { CompassIcon } from '../components/Icons'

interface Props {
  hasFocus: boolean
  onRequestSidebar: () => void
}

export default function BrowseScreen({ hasFocus, onRequestSidebar }: Props): JSX.Element {
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

  return (
    <div className="screen">
      <header className="screen__header">
        <h2 className="screen__title">Durchsuchen</h2>
      </header>
      <div className="screen__state">
        <CompassIcon style={{ width: 72, height: 72, opacity: 0.35 }} />
        <p>Kategorien und Top-Streams folgen in einer späteren Phase.</p>
      </div>
    </div>
  )
}
