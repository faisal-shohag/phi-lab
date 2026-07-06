// Shareable-link encoding: compress the source into a URL-safe string so a
// learner can share the exact code they're visualizing.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

const PARAM = 'code'

export function encodeCodeToUrl(code: string): string {
  const compressed = compressToEncodedURIComponent(code)
  const url = new URL(window.location.href)
  url.searchParams.set(PARAM, compressed)
  return url.toString()
}

// Push the encoded code into the address bar without a navigation.
export function syncCodeToLocation(code: string): void {
  const url = new URL(window.location.href)
  url.searchParams.set(PARAM, compressToEncodedURIComponent(code))
  window.history.replaceState(null, '', url.toString())
}

export function readCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URL(window.location.href).searchParams.get(PARAM)
  if (!raw) return null
  try {
    const decoded = decompressFromEncodedURIComponent(raw)
    return decoded && decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}
