// Pacing the renders.
//
// ── Why this is not optional ──
// Every score spends real CPU in a real browser. Vercel's Hobby plan includes
// 4 Active CPU-hours a month, and a Chromium render is pure active CPU — it is
// not I/O the way a database call is, so none of it is free. At roughly 1.5s per
// score on Hobby's single vCPU that is on the order of 9,600 scores a month,
// site-wide, across every learner.
//
// Going over does not degrade Pixel Lab. It pauses *every function on the
// account* until the 30-day window rolls: js-motion, auth, hive, all of it. One
// learner leaning on the Score button could take the site down for a month. So
// this is infrastructure, not politeness.
//
// ── What this is honestly worth ──
// The bucket lives in module scope. Fluid compute shares one instance across
// many invocations, so it mostly works — but instances are not the same thing as
// a server, and a user whose requests land on several of them gets several
// buckets. It paces honest use, which is what the CPU budget is actually
// threatened by. It does not stop someone deliberately trying, and if that ever
// happens the answer is a real store, not a bigger number here.

/** A score every 25 seconds, sustained. Comfortably above thinking-and-typing pace. */
const CAPACITY = 12
const WINDOW_MS = 5 * 60_000
const REFILL_PER_MS = CAPACITY / WINDOW_MS

interface Bucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Drop buckets nobody has touched for a full window.
 *
 * Without this the map is a slow leak keyed by user id, on an instance that
 * fluid compute may keep alive for a long time. A full bucket is also
 * indistinguishable from no bucket, so forgetting one costs nothing.
 */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > WINDOW_MS) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  /** Seconds until the next token, when `ok` is false. */
  retryAfter: number
}

/**
 * Take a token for `userId`, or report how long until one exists.
 *
 * Call this *before* rendering — it is the render being paid for, not the
 * request.
 */
export function takeRenderToken(userId: string, now = Date.now()): RateLimitResult {
  if (buckets.size > 500) sweep(now)

  const bucket = buckets.get(userId)
  if (!bucket) {
    buckets.set(userId, { tokens: CAPACITY - 1, updatedAt: now })
    return { ok: true, retryAfter: 0 }
  }

  const refilled = Math.min(CAPACITY, bucket.tokens + (now - bucket.updatedAt) * REFILL_PER_MS)
  bucket.updatedAt = now

  if (refilled < 1) {
    bucket.tokens = refilled
    return { ok: false, retryAfter: Math.ceil((1 - refilled) / REFILL_PER_MS / 1000) }
  }

  bucket.tokens = refilled - 1
  return { ok: true, retryAfter: 0 }
}

/** Testing seam. Buckets are process-global, so a test that skips this bleeds into the next. */
export function resetRateLimits(): void {
  buckets.clear()
}
