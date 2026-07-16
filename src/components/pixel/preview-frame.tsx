'use client'

import { useEffect, useState } from 'react'

import { loadFontFace } from '@/lib/pixel/assets'
import type { Canvas } from '@/lib/pixel/challenges'
import { buildSrcdoc, type FrameSource } from '@/lib/pixel/harness'
import { cn } from '@/lib/utils'

/**
 * The learner's build, live.
 *
 * ── It only displays ──
 * There is no capture here, and that is the entire shape of this component. An
 * earlier build drove snapdom inside this frame to rasterise the learner's work
 * and posted the PNG for scoring, which meant fighting for a paint that Chrome
 * withholds from frames it cannot see: requestAnimationFrame never fires for
 * them, setInterval is throttled to 1Hz in a background tab, and a frame the
 * parent has not laid out yet is genuinely 0x0. All of it — the ready signal,
 * the token protocol, the size-checked retries — existed to get one trustworthy
 * image out of a place that did not want to give one.
 *
 * The server renders now (lib/pixel/render.ts). So this frame just shows the
 * learner what they wrote, and nothing depends on when it paints.
 *
 * ── `sandbox=""` ──
 * No scripts, no same-origin, nothing. Never add `allow-same-origin`: paired
 * with `allow-scripts` it is a documented escape — the frame reaches out and
 * strips its own sandbox attribute — which would put learner-authored HTML on
 * our origin holding our session cookie, on a lab whose sibling already has
 * public share permalinks. `allow-scripts` alone is gone too, because the scored
 * render forbids scripts, and a preview that runs code the scorer will not is a
 * page the learner is shown but not graded on.
 */
export function PixelFrame({
  source,
  canvas,
  className,
  style,
  title = 'Your build',
}: {
  source: FrameSource
  canvas: Canvas
  className?: string
  style?: React.CSSProperties
  title?: string
}) {
  const [srcdoc, setSrcdoc] = useState('')

  useEffect(() => {
    let cancelled = false
    loadFontFace()
      .then((fontFace) => {
        if (!cancelled) setSrcdoc(buildSrcdoc({ source, canvas, fontFace }))
      })
      .catch(() => {
        // A fontless preview is worth more than an empty one, and the score comes
        // from the server regardless — it never reads this frame.
        if (!cancelled) setSrcdoc(buildSrcdoc({ source, canvas, fontFace: '' }))
      })
    return () => {
      cancelled = true
    }
  }, [source, canvas])

  // Not mounted until the document is ready, and that is load-bearing rather
  // than a nicety about flashes.
  //
  // The font is fetched, so the first render has nothing to show. Mount an
  // iframe with `srcdoc=""` and Chrome begins loading that empty document; the
  // real srcdoc then lands *before that load commits*, the empty load wins, and
  // the frame sits there blank forever. Every attribute reads correct while you
  // debug it — right srcdoc, right sandbox, right box — and it paints nothing.
  // Later edits work fine, because by then the empty load has long since
  // committed, which is what makes this look like anything but a race.
  //
  // Rendering the iframe only once there is a document to give it means its
  // first and only navigation is the right one.
  if (!srcdoc) {
    return (
      <div
        className={cn('bg-white', className)}
        style={{ width: canvas.width, height: canvas.height, ...style }}
      />
    )
  }

  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={srcdoc}
      className={cn('border-none bg-white', className)}
      style={{ width: canvas.width, height: canvas.height, ...style }}
    />
  )
}
