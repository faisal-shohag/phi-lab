// The render harness: the document a learner's HTML/CSS becomes, for both the
// live preview in their browser and the scored render in ours.
//
// One builder, both sides, deliberately. The preview *is* the thing being
// scored — if the two documents differ in any way (a script that runs in one, a
// font that loads in one, an animation frozen in one) then the learner is being
// shown one page and graded on another, and every such difference is a scoring
// bug wearing a costume.
//
// ── Pure CSS: no scripts, no images ──
// The CSP names `style-src` and `font-src` and nothing else. Everything else
// falls back to `default-src 'none'`.
//
// No `script-src` — every script blocked, inline and external, `javascript:`
// too. This is an HTML/CSS lab, so nothing is lost, and it means the scored
// render needs no JS engine cooperation to be trustworthy.
//
// No `img-src` — and this one is load-bearing, not tidiness. The target image is
// served to any signed-in learner, because it is the picture they are matching.
// Allow `img-src data:` and they can base64 that PNG and paste
// `<img src="data:image/png;base64,...">` into their HTML for a guaranteed 100%,
// on every challenge, forever. The size caps do not save you: a navbar PNG
// base64s to about 13KB, well under the 20,000 limit. Blocking images outright
// is the only thing that closes it, which is why Pixel Lab is pure CSS and why
// no challenge may ever ship an <img>, an SVG, or a background-image. CSSBattle
// enforces the same rule, and not by accident — it is what makes their scoring
// mean anything.
//
// No `connect-src` — it existed only because snapdom used to `fetch()` the
// data: URI it inlined. snapdom is gone.
//
// ── The preview frame's sandbox ──
// `sandbox=""`: no scripts, no same-origin, nothing. Never add
// `allow-same-origin` — with `allow-scripts` it is a documented escape (the
// frame reaches out and strips its own sandbox attribute), which would put
// learner-authored HTML on our origin holding our BetterAuth session cookie, on
// a lab whose sibling already has public share permalinks.

import { FONT_FAMILY } from './font'

export interface Canvas {
  width: number
  height: number
}

export interface FrameSource {
  html: string
  css: string
}

export const MAX_HTML = 20_000
export const MAX_CSS = 20_000

/**
 * The reset.
 *
 * Deliberately small and fixed: challenges are authored against it, so it has to
 * be byte-identical in the preview and in the scored render. If it drifts, every
 * existing challenge silently re-scores.
 *
 * The bundled face is the *only* family — see font.ts for why that is the
 * fairness fix for the whole lab.
 */
function reset(canvas: Canvas): string {
  return `
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: #ffffff; }
body {
  font-family: '${FONT_FAMILY}', sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; color: inherit; }
button { background: none; border: none; }
a { color: inherit; text-decoration: none; }
/* The scored area. The renderer screenshots exactly this element, so what comes
   out is always the challenge's canvas size — which is what makes the diff
   comparable to a reference of the same dimensions. */
#canvas {
  width: ${canvas.width}px;
  height: ${canvas.height}px;
  overflow: hidden;
  position: relative;
  background: #ffffff;
  flex: none;
}
`.trim()
}

/**
 * The one layer that overrides the learner.
 *
 * CSS animations and transitions run without any JavaScript, so a learner who
 * writes one makes their own score depend on the microsecond the screenshot
 * fired — the same code scoring 94% and then 71% for no reason they can see. A
 * target is a still image; motion can never help, and no challenge has ever
 * needed it. So it is frozen, after their CSS, with `!important`, in the preview
 * and the render alike — they still see exactly what is scored.
 *
 * This is the *only* thing that comes after the learner's rules. Anything else
 * added here silently rewrites what they wrote.
 */
const FREEZE = `*, *::before, *::after { animation: none !important; transition: none !important; }`

export interface SrcdocOptions {
  source: FrameSource
  canvas: Canvas
  fontFace: string
}

export function buildSrcdoc({ source, canvas, fontFace }: SrcdocOptions): string {
  const html = source.html.slice(0, MAX_HTML)
  const css = source.css.slice(0, MAX_CSS)

  // Order matters: font, then reset, then the learner's CSS so their rules win,
  // then the freeze.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:;">
<style>${fontFace}</style>
<style>${reset(canvas)}</style>
<style>${css}</style>
<style>${FREEZE}</style>
</head>
<body>
<div id="canvas">${html}</div>
</body>
</html>`
}
