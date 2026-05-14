export function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Mio.`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export function formatViewersFull(n: number): string {
  return n.toLocaleString('de-DE')
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatWatchedAt(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 2) return 'Gerade eben'
  if (mins < 60) return `Vor ${mins} Min.`
  if (hours < 24) return `Vor ${hours} Std.`
  if (days === 1) return 'Gestern'
  if (days < 7) return `Vor ${days} Tagen`
  return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTimestamp(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
