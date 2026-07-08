// Small pure formatting helpers for profile UI. Client-safe (no Prisma), so both
// the owner's dashboard and the public page can share them.

/** 1-2 letter avatar fallback from a name or email. */
export function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

/** "Member since March 2026" style label. */
export function memberSince(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Strip protocol/trailing slash for a compact link label. */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
