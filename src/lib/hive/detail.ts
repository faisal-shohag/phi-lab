// Shared loader for a post's full thread, used by both the SSR page and the
// polling GET route so they never drift.
import { prisma } from '@/lib/prisma'
import {
  serializePostCard,
  serializeReply,
  serializeEvent,
  type HivePostDetailDTO,
} from './serialize'

export async function loadPostDetail(
  postId: string,
  viewerId: string,
  /** Mentors/admins see which model answered and why a post escalated. */
  staff = false,
): Promise<HivePostDetailDTO | null> {
  const post = await prisma.hivePost.findUnique({
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
      follows: { where: { userId: viewerId }, select: { id: true } },
    },
  })
  if (!post) return null

  const myReactions = await prisma.hiveReaction.findMany({
    where: {
      userId: viewerId,
      OR: [{ postId: post.id }, { replyId: { in: post.replies.map((r) => r.id) } }],
    },
    select: { targetKey: true },
  })
  const myReactionKeys = new Set(myReactions.map((r) => r.targetKey))

  return {
    ...serializePostCard(post, { staff }),
    milestone: post.milestone,
    acceptedReplyId: post.acceptedReplyId,
    assignedMentorId: post.assignedMentorId,
    followedByMe: post.follows.length > 0,
    escalationReason: staff ? post.escalationReason : null,
    escalatedAfterAiReplies: staff ? post.escalatedAfterAiReplies : null,
    replies: post.replies.map((r) =>
      serializeReply(r, { acceptedReplyId: post.acceptedReplyId, myReactionKeys, staff }),
    ),
    events: post.events.map((e) => serializeEvent(e, { staff })),
  }
}
