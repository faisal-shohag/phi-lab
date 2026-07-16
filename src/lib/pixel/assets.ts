// Getting the font into the preview frame.
//
// The preview is `sandbox=""` under a `default-src 'none'` CSP, so it can load
// nothing: no font by URL, no fetch at all. Its opaque origin cannot even reach
// our own. So the parent fetches the woff2 — same-origin, trivial for it — and
// concatenates an inlined @font-face into the srcdoc string. That string is the
// only channel into the frame.
//
// The server does the same thing from disk (see render.ts) and both go through
// fontFaceCss(), so the two documents come out identical. They have to: the
// preview is the thing being scored.

import { fontFaceCss } from './font'

const FONT_URL = '/pixel-lab/geist-latin.woff2'

let fontPromise: Promise<string> | null = null

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  // Chunked: String.fromCharCode(...view) blows the argument limit on a 28KB
  // font in some engines.
  const CHUNK = 0x8000
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** Cached for the page's lifetime — it does not change between challenges. */
export async function loadFontFace(): Promise<string> {
  fontPromise ??= fetch(FONT_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`could not load the sandbox font (${res.status})`)
      return res.arrayBuffer()
    })
    .then((buf) => fontFaceCss(toBase64(buf)))
    .catch((err) => {
      // Do not cache a failure: a transient miss would otherwise leave the
      // preview fontless for the rest of the session.
      fontPromise = null
      throw err
    })
  return fontPromise
}
