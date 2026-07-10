// Shared loader for a post's full thread, used by both the SSR page and the
// polling GET route so they never drift.
import { unstable_cache as nextCache, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { postTag } from './cache'
import {
  serializePostCard,
  serializeReply,
  serializeEvent,
  type HivePostDetailDTO,
} from './serialize'

// Everything here is viewer-independent (no viewerId in the query), so it's
// safe to share across requests/viewers. Cached for 5min as a safety net;
// every mutation route revalidates the tag immediately on write, so this
// window only matters if a write path forgets to invalidate.
function getCachedPostCore(postId: string) {
  return nextCache(
    async () =>
      prisma.hivePost.findUnique({
        where: { id: postId },
        include: {
          author: { select: { id: true, name: true, image: true, role: true } },
          _count: { select: { replies: true, reactions: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { id: true, name: true, image: true, role: true } },
              _count: { select: { reactions: true } },
            },
          },
          events: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ['hive-post-core', postId],
    { tags: [postTag(postId)], revalidate: 300 },
  )()
}

export async function loadPostDetail(
  postId: string,
  viewerId: string,
  /** Mentors/admins see which model answered and why a post escalated. */
  staff = false,
): Promise<HivePostDetailDTO | null> {
  const post = await getCachedPostCore(postId)
  if (!post) return null

  // Viewer-scoped, so these stay outside the cached core: cheap indexed
  // point lookups, not the heavy nested include above.
  const [myFollow, myReactions] = await Promise.all([
    prisma.hiveFollow.findUnique({
      where: { userId_postId: { userId: viewerId, postId } },
      select: { id: true },
    }),
    prisma.hiveReaction.findMany({
      where: {
        userId: viewerId,
        OR: [{ postId: post.id }, { replyId: { in: post.replies.map((r) => r.id) } }],
      },
      select: { targetKey: true },
    }),
  ])
  const myReactionKeys = new Set(myReactions.map((r) => r.targetKey))

  return {
    ...serializePostCard(post, { staff }),
    milestone: post.milestone,
    acceptedReplyId: post.acceptedReplyId,
    assignedMentorId: post.assignedMentorId,
    followedByMe: myFollow !== null,
    escalationReason: staff ? post.escalationReason : null,
    escalatedAfterAiReplies: staff ? post.escalatedAfterAiReplies : null,
    replies: post.replies.map((r) =>
      serializeReply(r, { acceptedReplyId: post.acceptedReplyId, myReactionKeys, staff }),
    ),
    events: post.events.map((e) => serializeEvent(e, { staff })),
  }
}

export function invalidatePost(postId: string) {
  // { expire: 0 } is immediate expiry (read-your-own-writes) — see cache.ts.
  revalidateTag(postTag(postId), { expire: 0 })
}
