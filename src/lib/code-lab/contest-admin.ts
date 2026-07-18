// Server-only contest authoring: CRUD, author lookup, and the pool of problems
// eligible to attach. Admin-gated at the route layer (withAdmin).
import 'server-only'

import { prisma } from '@/lib/prisma'
import { contestStatus, type ContestStatus } from './contest-status'
import type { ProblemDifficulty } from './types'

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface ContestProblemInput {
  problemId: string
  points: number
  order: number
}

export interface ContestInput {
  slug: string
  title: string
  description: string
  authorId: string
  /** ISO strings from the datetime inputs. */
  startsAt: string
  endsAt: string
  published?: boolean
  problems: ContestProblemInput[]
}

export interface ContestAdminRow {
  id: string
  slug: string
  title: string
  status: ContestStatus
  published: boolean
  startsAt: Date
  endsAt: Date
  problemCount: number
}

export async function listContests(): Promise<ContestAdminRow[]> {
  const rows = await prisma.contest.findMany({
    orderBy: [{ startsAt: 'desc' }],
    select: {
      id: true, slug: true, title: true, published: true, startsAt: true, endsAt: true,
      _count: { select: { problems: true } },
    },
  })
  const now = new Date()
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    status: contestStatus(now, c.startsAt, c.endsAt),
    published: c.published,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    problemCount: c._count.problems,
  }))
}

export async function getContest(id: string) {
  return prisma.contest.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      problems: {
        orderBy: { order: 'asc' },
        include: { problem: { select: { id: true, slug: true, title: true, difficulty: true } } },
      },
    },
  })
}

/** Users who can be listed as a contest author. */
export async function listAuthors(): Promise<{ id: string; name: string; email: string; image: string | null }[]> {
  return prisma.user.findMany({
    where: { role: { in: ['MENTOR', 'ADMIN'] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, image: true },
  })
}

export interface EligibleProblem {
  id: string
  slug: string
  title: string
  difficulty: ProblemDifficulty
}

/**
 * Published problems that can be attached to a contest: not already tied to a
 * *different* contest (a problem belongs to at most one). Pass the contest being
 * edited so its own problems remain eligible.
 */
export async function eligibleProblems(forContestId?: string): Promise<EligibleProblem[]> {
  const rows = await prisma.problem.findMany({
    where: {
      published: true,
      OR: [{ contestProblem: null }, { contestProblem: { contestId: forContestId ?? '__none__' } }],
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, slug: true, title: true, difficulty: true },
  })
  return rows
}

async function validate(input: ContestInput, forContestId?: string): Promise<string | null> {
  if (!slugRe.test(input.slug.trim().toLowerCase())) return 'Slug must be kebab-case.'
  if (!input.title.trim()) return 'Title is required.'
  if (!input.description.trim()) return 'Description is required.'
  const starts = new Date(input.startsAt)
  const ends = new Date(input.endsAt)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return 'Start and end times are required.'
  if (ends.getTime() <= starts.getTime()) return 'End time must be after the start time.'
  if (input.problems.length === 0) return 'Add at least one problem.'
  for (const p of input.problems) {
    if (!p.problemId) return 'Every attached problem needs an id.'
    if (!Number.isInteger(p.points) || p.points <= 0) return 'Every problem needs a positive point value.'
  }
  const ids = input.problems.map((p) => p.problemId)
  if (new Set(ids).size !== ids.length) return 'A problem is attached more than once.'

  // Author must be a mentor/admin.
  const author = await prisma.user.findFirst({ where: { id: input.authorId, role: { in: ['MENTOR', 'ADMIN'] } }, select: { id: true } })
  if (!author) return 'Select a valid author (mentor or admin).'

  // No attached problem may belong to another contest.
  const taken = await prisma.contestProblem.findMany({
    where: { problemId: { in: ids }, NOT: { contestId: forContestId ?? '__none__' } },
    select: { problemId: true },
  })
  if (taken.length > 0) return 'A selected problem is already in another contest.'

  return null
}

export async function createContest(input: ContestInput, createdById: string): Promise<{ id: string } | { error: string }> {
  const err = await validate(input)
  if (err) return { error: err }
  const created = await prisma.contest.create({
    data: {
      slug: input.slug.trim().toLowerCase(),
      title: input.title.trim(),
      description: input.description,
      authorId: input.authorId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      published: input.published ?? false,
      createdById,
      problems: {
        create: input.problems.map((p) => ({ problemId: p.problemId, points: p.points, order: p.order })),
      },
    },
    select: { id: true },
  })
  return { id: created.id }
}

export async function updateContest(id: string, input: ContestInput): Promise<{ id: string } | { error: string }> {
  const existing = await prisma.contest.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return { error: 'NOT_FOUND' }
  const err = await validate(input, id)
  if (err) return { error: err }

  // Replace the problem set wholesale — simplest correct way to reconcile
  // additions, removals, point and order edits in one shot.
  await prisma.$transaction([
    prisma.contestProblem.deleteMany({ where: { contestId: id } }),
    prisma.contest.update({
      where: { id },
      data: {
        slug: input.slug.trim().toLowerCase(),
        title: input.title.trim(),
        description: input.description,
        authorId: input.authorId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        published: input.published ?? false,
        problems: {
          create: input.problems.map((p) => ({ problemId: p.problemId, points: p.points, order: p.order })),
        },
      },
    }),
  ])
  return { id }
}

export async function deleteContest(id: string) {
  await prisma.contest.delete({ where: { id } })
}
