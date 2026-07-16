import { describe, expect, it } from 'vitest'

import { DiffSizeError, diffImages, matchPercent } from '../diff'

const W = 20
const H = 10

function solid(r: number, g: number, b: number, a = 255): Uint8Array {
  const buf = new Uint8Array(W * H * 4)
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  return buf
}

describe('diffImages', () => {
  it('scores identical images 1.0', () => {
    const result = diffImages(solid(255, 0, 0), solid(255, 0, 0), W, H)
    expect(result.match).toBe(1)
    expect(result.diffPixels).toBe(0)
  })

  it('scores fully inverted images near 0', () => {
    const result = diffImages(solid(0, 0, 0), solid(255, 255, 255), W, H)
    expect(result.match).toBe(0)
    expect(result.diffPixels).toBe(W * H)
  })

  it('scores a single changed pixel just under 1', () => {
    const capture = solid(255, 255, 255)
    capture[0] = 0
    capture[1] = 0
    capture[2] = 0
    const result = diffImages(capture, solid(255, 255, 255), W, H)
    expect(result.diffPixels).toBe(1)
    expect(result.match).toBeCloseTo(1 - 1 / (W * H), 5)
  })

  it('scales with how much changed', () => {
    const half = solid(255, 255, 255)
    // Blacken the top half.
    for (let i = 0; i < (W * H * 4) / 2; i += 4) {
      half[i] = 0
      half[i + 1] = 0
      half[i + 2] = 0
    }
    const result = diffImages(half, solid(255, 255, 255), W, H)
    expect(result.match).toBeCloseTo(0.5, 2)
  })

  // This used to assert the opposite — that a shade too small to see was
  // tolerated — back when the submission was rasterised on the learner's machine
  // and the reference on the author's. Two engines meant real subpixel noise, and
  // a tolerance was the only thing between a correct answer and a score docked
  // for owning a Mac. Both sides now render in one browser (render.ts), so there
  // is no such noise, and a tolerance with nothing to absorb only hides mistakes:
  // an off-by-one colour is a real error and the learner can see it in Diff mode.
  it('counts a shade too small to see, because there is no cross-engine noise left', () => {
    const nudged = solid(255, 255, 255)
    for (let i = 0; i < nudged.length; i += 4) nudged[i + 1] = 253
    const result = diffImages(nudged, solid(255, 255, 255), W, H)
    expect(result.match).toBe(0)
  })

  it('still lets a caller opt back into tolerance', () => {
    const nudged = solid(255, 255, 255)
    for (let i = 0; i < nudged.length; i += 4) nudged[i + 1] = 253
    expect(diffImages(nudged, solid(255, 255, 255), W, H, { threshold: 0.1 }).match).toBe(1)
  })
})

// The denominator that makes a score mean something (score.ts): background both
// sides left alone is not an achievement, so it must not count.
describe('unionPixels', () => {
  /** A white canvas with `n` black pixels painted from the top-left. */
  function withInk(n: number): Uint8Array {
    const px = solid(255, 255, 255)
    for (let p = 0; p < n; p++) {
      const i = p * 4
      px[i] = 0
      px[i + 1] = 0
      px[i + 2] = 0
    }
    return px
  }

  it('counts nothing when neither side painted', () => {
    expect(diffImages(solid(255, 255, 255), solid(255, 255, 255), W, H).unionPixels).toBe(0)
  })

  it('counts the target’s ink when the learner drew nothing', () => {
    expect(diffImages(solid(255, 255, 255), withInk(10), W, H).unionPixels).toBe(10)
  })

  it('counts the learner’s ink when the target is empty', () => {
    expect(diffImages(withInk(10), solid(255, 255, 255), W, H).unionPixels).toBe(10)
  })

  it('counts a pixel once when both painted it', () => {
    expect(diffImages(withInk(10), withInk(10), W, H).unionPixels).toBe(10)
  })

  it('is the whole canvas when the design is full-bleed', () => {
    // Which is what makes the score degrade into the plain match there.
    expect(diffImages(solid(0, 0, 0), solid(0, 0, 0), W, H).unionPixels).toBe(W * H)
  })

  it('ignores antialiasing feathered into the background', () => {
    // Counting near-white fringes as ink would inflate the denominator with
    // pixels nobody drew on purpose.
    const feathered = solid(255, 255, 255)
    for (let i = 0; i < feathered.length; i += 4) feathered[i] = 250
    expect(diffImages(feathered, solid(255, 255, 255), W, H).unionPixels).toBe(0)
  })

  it('counts a transparent hole as painted', () => {
    // The reset makes the canvas opaque white, so alpha below full means the
    // learner did something — knocking a hole through is a real difference.
    const clear = solid(255, 255, 255)
    for (let p = 0; p < 5; p++) clear[p * 4 + 3] = 0
    expect(diffImages(clear, solid(255, 255, 255), W, H).unionPixels).toBe(5)
  })

  it('counts a difference that is actually visible', () => {
    const grey = solid(128, 128, 128)
    const result = diffImages(grey, solid(255, 255, 255), W, H)
    expect(result.match).toBeLessThan(0.1)
  })

  // The failure mode this prevents: a size mismatch is a broken challenge, but
  // scoring it would show up as a bad attempt and send the learner hunting for a
  // mistake in their CSS that does not exist.
  it('throws on a size mismatch rather than scoring it', () => {
    const small = new Uint8Array(4 * 4 * 4)
    expect(() => diffImages(small, solid(255, 255, 255), W, H)).toThrow(DiffSizeError)
  })

  it('throws when the reference is the wrong size too', () => {
    expect(() => diffImages(solid(0, 0, 0), new Uint8Array(8), W, H)).toThrow(DiffSizeError)
  })

  it('refuses a zero-sized canvas', () => {
    expect(() => diffImages(new Uint8Array(0), new Uint8Array(0), 0, 0)).toThrow()
  })

  it('only builds a diff image when asked', () => {
    expect(diffImages(solid(0, 0, 0), solid(0, 0, 0), W, H).image).toBeNull()
    const withImage = diffImages(solid(0, 0, 0), solid(255, 255, 255), W, H, { withImage: true })
    expect(withImage.image).toHaveLength(W * H * 4)
  })

  it('accepts Uint8ClampedArray, which is what canvas hands out', () => {
    const canvasLike = new Uint8ClampedArray(solid(10, 20, 30))
    expect(diffImages(canvasLike, solid(10, 20, 30), W, H).match).toBe(1)
  })
})

describe('matchPercent', () => {
  it('rounds to one decimal', () => {
    expect(matchPercent(1)).toBe(100)
    expect(matchPercent(0.9876)).toBe(98.8)
    expect(matchPercent(0)).toBe(0)
  })
})
