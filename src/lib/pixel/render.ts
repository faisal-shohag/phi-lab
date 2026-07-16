// Rendering learner HTML/CSS to a PNG, in a headless Chromium, on our
// infrastructure.
//
// ── Why this exists ──
// It is the whole reason the score means anything. The previous build
// rasterised the learner's iframe on *their* machine (snapdom) and accepted the
// PNG they posted. The target is on screen by necessity, so it could be posted
// straight back for a guaranteed 100%, and nothing client-side could close that.
// Now the client sends `{ html, css }` — there is no image to forge, and the
// only way to score is code that renders to the target.
//
// ── Why the reference renders here too ──
// Targets are not stored anywhere. `complete` renders the submission and the
// reference in the same browser, same invocation, and diffs them. That makes
// drift *unrepresentable* rather than merely avoided: there is no second
// artifact to fall out of step with the reference source. It is also why a
// correct answer lands on exactly 1.0 in dev — where this drives your local
// Chrome — and in production, where it drives a Linux binary from
// @sparticuz/chromium. The binaries differ; it does not matter, because both
// sides of any single diff always come out of the same one.
//
// ── The security posture, stated plainly ──
// Learner code used to run in an opaque-origin iframe on their own machine with
// no network. It now runs on ours, in a Chromium that @sparticuz/chromium must
// launch with `--no-sandbox` (Lambda cannot do user namespaces). That is a real
// change and the accepted risk of this design. What stands in front of it:
//   1. The CSP forbids scripts entirely (harness.ts). No JS runs — no JIT, none
//      of the surface that makes browser sandbox escapes interesting.
//   2. No network is reachable from the page: `default-src 'none'`, plus the
//      request interception below aborts anything that is not the document.
//   3. A hard timeout, and the page is always closed.
// Do not claim more than that.

import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import chromium from '@sparticuz/chromium'
import puppeteer, { type Browser } from 'puppeteer-core'

import { fontFaceCss } from './font'
import { buildSrcdoc, type Canvas, type FrameSource } from './harness'

/** A render that has not finished in this long is not going to. */
const RENDER_TIMEOUT_MS = 15_000

/**
 * Recycle the browser periodically. A long-lived Chromium accumulates memory,
 * and a fluid-compute instance can live for a long time across many
 * invocations; a leak here surfaces as an OOM on somebody's unrelated request.
 */
const MAX_RENDERS_PER_BROWSER = 200

let browserPromise: Promise<Browser> | null = null
let rendersOnBrowser = 0

/**
 * WebGL is not something a CSS challenge can use, and turning it off skips
 * extracting swiftshader.tar.br on every cold start. CSS is rasterised by Skia
 * on the CPU either way.
 */
chromium.setGraphicsMode = false

async function executablePath(): Promise<string> {
  if (process.env.NODE_ENV === 'production') return chromium.executablePath()

  // The sparticuz binary is Linux x64 and will not run on a dev machine, so
  // locally we drive whatever Chrome is already installed.
  const local = process.env.CHROME_PATH
  if (!local) {
    throw new Error(
      'CHROME_PATH is not set. Pixel Lab renders in a real browser; in development it needs a path ' +
        'to your local Chrome or Chromium binary. See public/pixel-lab/README.md.',
    )
  }
  return local
}

async function launch(): Promise<Browser> {
  const production = process.env.NODE_ENV === 'production'
  return puppeteer.launch({
    args: [
      ...chromium.args,
      // Pins the colour profile. Without it a target rendered under one profile
      // and a submission under another differ everywhere, faintly, forever.
      '--force-color-profile=srgb',
    ],
    executablePath: await executablePath(),
    // The sparticuz binary is a *headless shell* build — chromium.args already
    // says so with --headless='shell'. Modern puppeteer-core reads
    // `headless: true` as the new headless mode and appends its own conflicting
    // flag; 'shell' is the mode that binary actually is. Locally we drive a
    // full Chrome, where 'shell' would be the wrong claim.
    headless: production ? 'shell' : true,
  })
}

async function getBrowser(): Promise<Browser> {
  const existing = await browserPromise?.catch(() => null)
  if (existing && existing.connected && rendersOnBrowser < MAX_RENDERS_PER_BROWSER) {
    return existing
  }

  if (existing) {
    // Retire it in the background; a close that hangs must not fail the render
    // that is waiting on the replacement.
    void existing.close().catch(() => {})
  }

  rendersOnBrowser = 0
  browserPromise = launch().catch((err) => {
    // Never cache a failed launch — the next request would inherit it forever.
    browserPromise = null
    throw err
  })
  return browserPromise
}

let fontFacePromise: Promise<string> | null = null

/**
 * The bundled face, read off disk and inlined.
 *
 * Chromium in Lambda has no system fonts at all, so this is not a fairness nicety
 * here — without it there is nothing to render text with. `outputFileTracingIncludes`
 * in next.config.ts is what gets the woff2 into the deployed bundle; the path is
 * opened rather than imported, so the tracer cannot find it alone.
 */
function loadFontFace(): Promise<string> {
  fontFacePromise ??= readFile(join(process.cwd(), 'public', 'pixel-lab', 'geist-latin.woff2'))
    .then((buf) => fontFaceCss(buf.toString('base64')))
    .catch((err) => {
      fontFacePromise = null
      throw err
    })
  return fontFacePromise
}

export class RenderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RenderError'
  }
}

/**
 * Render one document and screenshot its `#canvas`.
 *
 * Screenshotting the element rather than the viewport is what guarantees the
 * output is exactly the challenge's canvas size, which is what `pixelmatch`
 * requires of both its inputs.
 */
export async function renderToPng(source: FrameSource, canvas: Canvas): Promise<Buffer> {
  // Wrapped so a launch failure surfaces as a RenderError like every other
  // render failure. Unwrapped it fell through to the route's "no target" 503,
  // which blamed the challenge for what was an infrastructure fault — and
  // logged nothing.
  let browser: Browser
  try {
    browser = await getBrowser()
  } catch (err) {
    throw new RenderError(
      `chromium failed to launch: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
  rendersOnBrowser++

  const page = await browser.newPage()
  try {
    page.setDefaultTimeout(RENDER_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(RENDER_TIMEOUT_MS)

    // deviceScaleFactor: 1 is load-bearing. It defaults to the device's, and a
    // 2x render could never match a 1x reference — a correct answer would score
    // zero on nothing but the machine it rendered on.
    await page.setViewport({ width: canvas.width, height: canvas.height, deviceScaleFactor: 1 })

    // Belt to the CSP's braces. The CSP already permits no network, but this
    // stops a request before it leaves the process rather than after.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (req.isInterceptResolutionHandled()) return
      void (req.resourceType() === 'document' ? req.continue() : req.abort())
    })

    const html = buildSrcdoc({ source, canvas, fontFace: await loadFontFace() })
    await page.setContent(html, { waitUntil: 'load' })

    // Text metrics move when a face swaps in, and a screenshot taken mid-swap is
    // a page nobody ever saw. This runs over CDP, which is not subject to the
    // page's CSP — which is exactly why the page can forbid every script and we
    // can still wait for this.
    await page.evaluateHandle('document.fonts.ready')

    const target = await page.$('#canvas')
    if (!target) throw new RenderError('the render produced no #canvas')

    const shot = await target.screenshot({ type: 'png' })
    return Buffer.from(shot)
  } catch (err) {
    if (err instanceof RenderError) throw err
    throw new RenderError(err instanceof Error ? err.message : String(err), { cause: err })
  } finally {
    await page.close().catch(() => {})
  }
}
