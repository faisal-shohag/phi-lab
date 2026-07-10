// Per-user daily counter for actions that leave no database row to count — the
// pre-post coach runs before a post exists, so the analogies-style
// `count(createdAt >= today)` trick doesn't apply.
//
// This is deliberately in-memory: it resets on deploy and is per-instance, so
// it's a courtesy throttle against runaway loops, not a security control. The
// costly paths (post creation, AI attempts) are all row-counted.

interface Bucket {
  day: string
  count: number
}

const buckets = new Map<string, Bucket>()

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns true when the call is allowed, and records it. */
export function consumeDaily(key: string, limit: number): boolean {
  const day = today()
  const b = buckets.get(key)
  if (!b || b.day !== day) {
    buckets.set(key, { day, count: 1 })
    return true
  }
  if (b.count >= limit) return false
  b.count++
  return true
}
