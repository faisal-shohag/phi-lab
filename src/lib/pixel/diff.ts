// The score.
//
// Pure and environment-free: it takes two RGBA buffers and returns how alike
// they are. Both buffers are decoded from PNGs that came out of the same
// headless Chromium, in the same invocation (see render.ts) — the submission and
// the reference. That is what makes an exact comparison fair here.

import pixelmatch from 'pixelmatch'

/** RGBA, 4 bytes per pixel, row-major — what canvas and pngjs both hand out. */
export type Rgba = Uint8Array | Uint8ClampedArray

/**
 * Exact.
 *
 * This used to be pixelmatch's default 0.1, back when the submission was
 * rasterised on the learner's machine and the reference on the author's: two
 * engines, two subpixel results, and a tolerance was the only thing standing
 * between a correct answer and a score docked for owning a Mac. Both sides now
 * render in one browser, so there is no such noise left — and a tolerance with
 * no noise to absorb only hides real mistakes.
 *
 * Measured before changing it, because the fear is the obvious one — that this
 * punishes a learner who wrote the same thing a different way. It does not:
 * rewriting `24px` as `1.5rem` in card-01's reference renders **byte-identical**,
 * 0 pixels differing. Equivalent CSS computes to equivalent layout and rasterises
 * the same. Meanwhile a genuinely wrong answer (padding off by one pixel) shows
 * 221 differing pixels here versus 172 at 0.1 — 28% more signal, which matters
 * most on the sparse canvases where a plainly-wrong answer already scores 99%.
 *
 * `includeAA` stays default-false, which — note the inverted name — means
 * pixelmatch still *detects* antialiased pixels and does not count them.
 */
const DEFAULT_THRESHOLD = 0

export interface DiffOptions {
  /** How different two pixels must be to count. Defaults to exact — see above. */
  threshold?: number
  /** Produce a diff image for the UI to overlay. Costs a third buffer. */
  withImage?: boolean
}

export interface DiffResult {
  /** 0…1 over the whole canvas. 1 means every pixel matched. Weak on a sparse canvas — see score.ts. */
  match: number
  diffPixels: number
  totalPixels: number
  /**
   * Pixels that either side painted — the union of the two images' ink.
   *
   * The denominator that makes a score mean something (score.ts). Background
   * that both sides left alone is not an achievement and is not counted, which
   * is what stops a 2%-ink navbar from scoring 97% for an empty editor. On a
   * full-bleed canvas every pixel is ink, so this equals `totalPixels` and the
   * score degrades gracefully into the plain match.
   */
  unionPixels: number
  /** RGBA of the diff render, only when `withImage`. */
  image: Uint8Array | null
}

export class DiffSizeError extends Error {
  constructor(
    readonly actual: { width: number; height: number },
    readonly expected: { width: number; height: number },
  ) {
    super(
      `capture is ${actual.width}x${actual.height} but the reference is ${expected.width}x${expected.height}`,
    )
    this.name = 'DiffSizeError'
  }
}

const BYTES_PER_PIXEL = 4

/**
 * Compare a capture against a reference.
 *
 * Throws on a size mismatch rather than scoring it. pixelmatch would read past
 * the end of the shorter buffer and return a number, and a number is worse than
 * an error here: it would look like a bad attempt instead of a broken challenge,
 * and the learner would go hunting for a mistake in their CSS that isn't there.
 */
export function diffImages(
  capture: Rgba,
  reference: Rgba,
  width: number,
  height: number,
  options: DiffOptions = {},
): DiffResult {
  if (width <= 0 || height <= 0) {
    throw new Error(`cannot diff a ${width}x${height} canvas`)
  }

  const expected = width * height * BYTES_PER_PIXEL
  if (capture.length !== expected || reference.length !== expected) {
    const actualPixels = capture.length / BYTES_PER_PIXEL
    throw new DiffSizeError(
      { width: Math.round(actualPixels / Math.max(1, height)), height },
      { width, height },
    )
  }

  const totalPixels = width * height
  const image = options.withImage ? new Uint8Array(expected) : null

  // `includeAA: true` — and the name is a trap. It means *skip* antialiasing
  // detection, i.e. count antialiased pixels as ordinary differences. The
  // default (false) is the tolerant one, and it was right when the two sides
  // came from two engines.
  //
  // It is wrong now, for the same reason `threshold: 0` is right: one browser
  // renders both sides, so identical content produces identical antialiasing and
  // there is no noise to forgive. Leaving detection on actively broke the score —
  // glyphs are mostly antialiased edges, so a blank canvas versus a text-heavy
  // target only "differed" on the solid cores of letters while the union counted
  // the whole glyph, and an empty editor read 44.6% on hero-04. Measured.
  //
  // `undefined`, not `null`: pixelmatch's output parameter is typed `void` when
  // absent, and null is not that.
  const diffPixels = pixelmatch(capture, reference, image ?? undefined, width, height, {
    threshold: options.threshold ?? DEFAULT_THRESHOLD,
    includeAA: true,
  })

  return {
    match: totalPixels === 0 ? 0 : 1 - diffPixels / totalPixels,
    diffPixels,
    totalPixels,
    unionPixels: countUnionInk(capture, reference, totalPixels),
    image,
  }
}

/**
 * How far off white a pixel has to be to count as painted.
 *
 * The reset makes `#canvas` white, so white is "nothing here". A tolerance
 * rather than an equality because antialiasing feathers every edge into the
 * background, and counting those near-white fringes as ink would inflate the
 * union with pixels nobody drew on purpose.
 */
const INK_TOLERANCE = 8

function isInk(px: Rgba, i: number): boolean {
  return (
    px[i + 3] < 250 ||
    255 - px[i] > INK_TOLERANCE ||
    255 - px[i + 1] > INK_TOLERANCE ||
    255 - px[i + 2] > INK_TOLERANCE
  )
}

/**
 * Pixels either image painted.
 *
 * One pass over both buffers. The alternative — deriving it from ink density per
 * challenge — cannot see the *learner's* ink, and their ink is exactly what
 * makes a wrong answer wrong.
 */
function countUnionInk(capture: Rgba, reference: Rgba, totalPixels: number): number {
  let union = 0
  for (let p = 0; p < totalPixels; p++) {
    const i = p * BYTES_PER_PIXEL
    if (isInk(capture, i) || isInk(reference, i)) union++
  }
  return union
}

/** Percent, rounded for display. Kept here so client and server round alike. */
export function matchPercent(match: number): number {
  return Math.round(match * 1000) / 10
}
