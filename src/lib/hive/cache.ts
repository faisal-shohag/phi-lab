// Tag helpers for unstable_cache/revalidateTag so call sites don't hand-roll
// cache key strings. One post's core detail lives under its own tag;
// FEED_TAG covers every cached feed-list query string.
import { revalidateTag } from 'next/cache'

export const postTag = (postId: string) => `hive-post-${postId}`
export const FEED_TAG = 'hive-feed'
export const HONEYCOMB_TAG = 'hive-honeycomb'

// Next 16's revalidateTag requires a profile arg. `{ expire: 0 }` is the
// immediate-expiry equivalent of the old single-arg behavior — writes must be
// visible right away (read-your-own-writes), and `updateTag` (which gives
// that for free) only works inside Server Actions, not our Route Handlers.
export function invalidateFeed() {
  revalidateTag(FEED_TAG, { expire: 0 })
}

export function invalidateHoneycomb() {
  revalidateTag(HONEYCOMB_TAG, { expire: 0 })
}
