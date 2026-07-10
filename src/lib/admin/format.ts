// Number formatting for the admin dashboard. Token counts reach seven figures,
// and a raw 1483920 in a stat tile is unreadable.

export function compactNumber(n: number): string {
  if (Math.abs(n) < 1000) return String(n)
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function fullNumber(n: number): string {
  return new Intl.NumberFormat('en').format(n)
}

export function percent(n: number): string {
  return `${n}%`
}

/** Latency: sub-second in ms, above that in seconds. */
export function duration(ms: number): string {
  if (ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function relativeTime(iso: string | Date): string {
  const then = typeof iso === 'string' ? new Date(iso) : iso
  const seconds = Math.round((Date.now() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return then.toLocaleDateString()
}
