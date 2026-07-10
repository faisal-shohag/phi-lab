// Client-safe Hive DTO shapes. Kept separate from serialize.ts (which imports
// Prisma types + runtime helpers) so client components can import these without
// pulling server code into the bundle.

export type HivePostType = 'QUESTION' | 'ANNOUNCEMENT' | 'ENCOURAGEMENT'
export type HivePostStatus = 'OPEN' | 'AI_WORKING' | 'ESCALATED' | 'RESOLVED' | 'ARCHIVED'
export type HiveAuthorType = 'STUDENT' | 'MENTOR' | 'AI'
export type HiveReplyKind = 'ANSWER' | 'CLARIFYING_QUESTION' | 'COMMENT'
export type HiveVerification = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

export type HiveRole = 'STUDENT' | 'MENTOR' | 'ADMIN'

export interface HiveAuthorDTO {
  id: string | null
  name: string
  image: string | null
  isAI: boolean
  /** null for Hive AI, which has no account and therefore no role. */
  role: HiveRole | null
}

export interface HiveReplyDTO {
  id: string
  authorType: HiveAuthorType
  author: HiveAuthorDTO
  kind: HiveReplyKind
  body: string
  images: string[]
  aiAttempt: number | null
  /**
   * Which model wrote this AI reply. Populated for mentors/admins only —
   * students always see one consistent "Hive AI" identity.
   */
  aiProvider: string | null
  verification: HiveVerification
  verifyNote: string | null
  nectar: number
  reactedByMe: boolean
  isAccepted: boolean
  createdAt: string
}

export interface HivePostCardDTO {
  id: string
  type: HivePostType
  title: string
  body: string
  images: string[]
  tags: string[]
  topic: string | null
  severity: string | null
  status: HivePostStatus
  pinned: boolean
  sensitive: boolean
  author: HiveAuthorDTO
  replyCount: number
  nectar: number
  aiAttemptCount: number
  /** Staff-only, on AI-authored (encouragement) posts. */
  aiProvider: string | null
  createdAt: string
  expiresAt: string
}

export interface HiveEventDTO {
  id: string
  type: string
  meta: unknown
  createdAt: string
}

export interface HivePostDetailDTO extends HivePostCardDTO {
  milestone: string | null
  acceptedReplyId: string | null
  assignedMentorId: string | null
  replies: HiveReplyDTO[]
  events: HiveEventDTO[]
  followedByMe: boolean
  /** Staff-only. Why the post was handed to a human, and after how much AI work. */
  escalationReason: string | null
  escalatedAfterAiReplies: number | null
}

export interface HiveViewer {
  id: string
  role: 'STUDENT' | 'MENTOR' | 'ADMIN'
}
