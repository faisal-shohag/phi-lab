// Shared response shapes for Hive API routes + client components, so the feed
// card and the detail view read the same fields. Server-only (imports Prisma
// types) but the exported interfaces are safe to import from client code.
import type {
  HivePost,
  HiveReply,
  HivePostEvent,
  User,
} from '@/generated/prisma/client'
import type {
  HiveAuthorDTO,
  HiveReplyDTO,
  HivePostCardDTO,
  HiveEventDTO,
} from './types'

export type {
  HiveAuthorDTO,
  HiveReplyDTO,
  HivePostCardDTO,
  HiveEventDTO,
  HivePostDetailDTO,
} from './types'

const AI_AUTHOR: HiveAuthorDTO = {
  id: null,
  name: 'Hive AI',
  image: null,
  isAI: true,
  role: null,
}

/** The author shape every Hive surface renders. `role` drives the Mentor/Admin badge. */
export type HiveAuthorSelect = Pick<User, 'id' | 'name' | 'image' | 'role'>

function authorDTO(user: HiveAuthorSelect | null | undefined, isAI: boolean): HiveAuthorDTO {
  if (isAI || !user) return AI_AUTHOR
  return { id: user.id, name: user.name, image: user.image, isAI: false, role: user.role }
}

/**
 * Which model produced a reply/post is operational detail, not product surface.
 * Students see one "Hive AI"; only mentors and admins see GEMINI/OLLAMA/GROQ.
 * The gate lives here, in serialization, so no route can leak it by forgetting.
 */
export interface ViewerScope {
  /** true for MENTOR and ADMIN. */
  staff: boolean
}

/** Event meta carries `provider` and `confidence` — both staff-only. */
const STAFF_ONLY_META_KEYS = ['provider', 'confidence']

function scrubMeta(meta: unknown, staff: boolean): unknown {
  if (staff || !meta || typeof meta !== 'object') return meta
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (!STAFF_ONLY_META_KEYS.includes(k)) out[k] = v
  }
  return out
}

export function serializeReply(
  reply: HiveReply & {
    author?: HiveAuthorSelect | null
    _count?: { reactions: number }
  },
  opts: { acceptedReplyId: string | null; myReactionKeys: Set<string>; staff: boolean },
): HiveReplyDTO {
  return {
    id: reply.id,
    authorType: reply.authorType,
    author: authorDTO(reply.author, reply.authorType === 'AI'),
    kind: reply.kind,
    body: reply.body,
    images: reply.images,
    aiAttempt: reply.aiAttempt,
    aiProvider: opts.staff ? reply.aiProvider : null,
    verification: reply.verification,
    verifyNote: reply.verifyNote,
    nectar: reply._count?.reactions ?? 0,
    reactedByMe: opts.myReactionKeys.has(`reply:${reply.id}`),
    isAccepted: opts.acceptedReplyId === reply.id,
    createdAt: reply.createdAt.toISOString(),
  }
}

export function serializePostCard(
  post: HivePost & {
    author?: HiveAuthorSelect | null
    _count?: { replies: number; reactions: number }
  },
  viewer: ViewerScope = { staff: false },
): HivePostCardDTO {
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    body: post.body,
    images: post.images,
    tags: post.tags,
    topic: post.topic,
    severity: post.severity,
    status: post.status,
    pinned: post.pinned,
    sensitive: post.sensitive,
    author: authorDTO(post.author, post.authorId === null),
    replyCount: post._count?.replies ?? 0,
    nectar: post._count?.reactions ?? 0,
    aiAttemptCount: post.aiAttemptCount,
    aiProvider: viewer.staff ? post.aiProvider : null,
    createdAt: post.createdAt.toISOString(),
    expiresAt: post.expiresAt.toISOString(),
  }
}

export function serializeEvent(e: HivePostEvent, viewer: ViewerScope = { staff: false }): HiveEventDTO {
  return {
    id: e.id,
    type: e.type,
    meta: scrubMeta(e.meta, viewer.staff),
    createdAt: e.createdAt.toISOString(),
  }
}
