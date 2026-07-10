// Hive feed (GET) and post creation (POST).
//
// GET  — cursor-paginated feed with optional tag/type/status/q filters. Pinned
//        announcements always float to the top of the first page. Opportunistic
//        lazy cleanup of expired posts runs here (throttled).
// POST — create a QUESTION, triage it inline (fast, and it decides whether the
//        post must skip the AI entirely), then generate the first AI answer in
//        `after()` so the student sees their post immediately. `maxDuration`
//        reserves headroom for that background work.
import { after } from 'next/server'
import { requireHiveUser, isMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { maybeSweepExpired } from '@/lib/hive/cleanup'
import { serializePostCard } from '@/lib/hive/serialize'
import { triagePost } from '@/lib/hive/ai'
import { runAiAttempt, escalatePost } from '@/lib/hive/attempts'
import { awardXp } from '@/lib/gamification/award'
import { hivePostXp } from '@/lib/gamification/reasons'
import {
  POST_TTL_MS,
  MAX_TITLE_LEN,
  MAX_BODY_LEN,
  MAX_IMAGES_PER_POST,
  DAILY_POST_LIMIT,
  HIVE_TAGS,
} from '@/lib/hive/constants'
import type { Prisma } from '@/generated/prisma/client'

export const maxDuration = 60

const PAGE_SIZE = 20

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function GET(request: Request) {
  // The feed is auth-gated but has no per-viewer fields, so the user is only
  // needed for the gate.
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)
  const staff = isMentor(user)

  void maybeSweepExpired()

  const url = new URL(request.url)
  const tag = url.searchParams.get('tag')
  const type = url.searchParams.get('type')
  const status = url.searchParams.get('status')
  const q = url.searchParams.get('q')?.trim()
  const cursor = url.searchParams.get('cursor')

  const where: Prisma.HivePostWhereInput = {}
  if (tag && HIVE_TAGS.includes(tag as (typeof HIVE_TAGS)[number])) where.tags = { has: tag }
  if (type === 'QUESTION' || type === 'ANNOUNCEMENT' || type === 'ENCOURAGEMENT') where.type = type
  if (status === 'OPEN' || status === 'AI_WORKING' || status === 'ESCALATED' || status === 'RESOLVED') {
    where.status = status
  }
  // Archived posts belong to Honeycomb, not the live feed.
  if (!where.status) where.status = { not: 'ARCHIVED' }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ]
  }

  const posts = await prisma.hivePost.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      _count: { select: { replies: true, reactions: true } },
    },
  })

  const hasMore = posts.length > PAGE_SIZE
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts

  return Response.json({
    posts: page.map((p) => serializePostCard(p, { staff })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}

export async function POST(request: Request) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  let title = ''
  let body = ''
  let images: string[] = []
  let tags: string[] = []
  try {
    const json = await request.json()
    if (typeof json?.title === 'string') title = json.title.trim().slice(0, MAX_TITLE_LEN)
    if (typeof json?.body === 'string') body = json.body.trim().slice(0, MAX_BODY_LEN)
    if (Array.isArray(json?.images)) {
      images = json.images
        .filter((u: unknown): u is string => typeof u === 'string')
        .slice(0, MAX_IMAGES_PER_POST)
    }
    if (Array.isArray(json?.tags)) {
      tags = json.tags
        .filter((t: unknown): t is string => typeof t === 'string' && HIVE_TAGS.includes(t as (typeof HIVE_TAGS)[number]))
        .slice(0, 3)
    }
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (title.length < 5) return hiveError('VALIDATION', 'Give your question a clear title (5+ characters).')
  if (body.length < 10) return hiveError('VALIDATION', 'Describe your problem in a bit more detail.')

  const todayCount = await prisma.hivePost.count({
    where: { authorId: user.id, createdAt: { gte: startOfTodayUTC() } },
  })
  if (todayCount >= DAILY_POST_LIMIT) return hiveError('DAILY_LIMIT')

  const expiresAt = new Date(Date.now() + POST_TTL_MS)

  // Triage runs inline: it's a single fast call, and its `sensitive` verdict
  // decides whether the post may enter the AI loop at all. A triage failure
  // must not block the student from posting.
  let triage: Awaited<ReturnType<typeof triagePost>> | null = null
  try {
    triage = await triagePost(title, body, { userId: user.id })
  } catch {
    // fall through with no classification
  }

  const mergedTags = Array.from(new Set([...tags, ...(triage?.tags ?? [])])).slice(0, 3)
  const sensitive = triage?.sensitive ?? false
  const sensitiveReason = triage?.sensitiveReason
  // Start in AI_WORKING (unless a human must take it) so the thread page shows
  // "Bee is thinking…" and polls from the very first render.
  const initialStatus = sensitive ? 'OPEN' : 'AI_WORKING'

  const post = await prisma.hivePost.create({
    data: {
      authorId: user.id,
      type: 'QUESTION',
      title,
      body,
      images,
      tags: mergedTags,
      topic: triage?.topic ?? null,
      milestone: triage?.milestone ?? null,
      severity: triage?.severity ?? null,
      sensitive,
      status: initialStatus,
      expiresAt,
      events: {
        create: triage
          ? [{ type: 'created' }, { type: 'triaged', meta: { ...triage } }]
          : [{ type: 'created' }],
      },
    },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      _count: { select: { replies: true, reactions: true } },
    },
  })

  try {
    await awardXp({
      userId: user.id,
      reason: 'hive_post_created',
      sourceId: post.id,
      amount: hivePostXp(),
      meta: { topic: post.topic },
    })
  } catch {
    // XP is best-effort
  }

  if (sensitive) {
    // Mental-health, harassment, integrity, billing: a human handles it. The AI
    // never attempts an answer.
    after(() => escalatePost(post.id, sensitiveReason || 'sensitive topic'))
  } else {
    // Answer in the background so the student sees their post immediately; the
    // thread page polls until the reply lands.
    after(() => runAiAttempt(post.id, 1))
  }

  return Response.json({ post: serializePostCard(post, { staff: isMentor(user) }) }, { status: 201 })
}
