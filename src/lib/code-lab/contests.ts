// Server-only contest reads for learners. Keeps the server-only contract:
// nothing here ships solutionJs or hidden cases, and UPCOMING contests never
// leak their problems.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { CODE_LAB_SOLVED_REASON } from './xp'
import { contestStatus, type ContestStatus } from './contest-status'
import { rankContest, type ScoredEntry } from './contest-score'
import { buildLearnerProblem, type LearnerProblem } from './queries'
import type { ProblemDifficulty } from './types'

export interface ContestSummary {
  slug: string
  title: string
  description: string
  author: { name: string; image: string | null }
  startsAt: Date
  endsAt: Date
  status: ContestStatus
  problemCount: number
}

/** Published contests, newest window first, each with derived status + counts. */
export async function listVisibleContests(): Promise<ContestSummary[]> {
  const rows = await prisma.contest.findMany({
    where: { published: true },
    orderBy: [{ startsAt: 'desc' }],
    select: {
      slug: true, title: true, description: true, startsAt: true, endsAt: true,
      author: { select: { name: true, image: true } },
      _count: { select: { problems: true } },
    },
  })
  const now = new Date()
  return rows.map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    author: { name: c.author.name, image: c.author.image },
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    status: contestStatus(now, c.startsAt, c.endsAt),
    problemCount: c._count.problems,
  }))
}

export interface ContestProblemRow {
  order: number
  slug: string
  title: string
  difficulty: ProblemDifficulty
  points: number
  solved: boolean
}

export interface ContestDetail {
  slug: string
  title: string
  description: string
  author: { name: string; image: string | null }
  startsAt: Date
  endsAt: Date
  status: ContestStatus
  /** Empty while UPCOMING — problems are hidden until the contest starts. */
  problems: ContestProblemRow[]
  myRank: number | null
  myPoints: number
}

/**
 * A published contest for the learner. Problems (and their slugs) are withheld
 * entirely until the contest starts.
 */
export async function getContestForLearner(slug: string, userId: string): Promise<ContestDetail | null> {
  const c = await prisma.contest.findFirst({
    where: { slug, published: true },
    select: {
      id: true, slug: true, title: true, description: true, startsAt: true, endsAt: true,
      author: { select: { name: true, image: true } },
      problems: {
        orderBy: { order: 'asc' },
        select: {
          points: true, order: true,
          problem: { select: { id: true, slug: true, title: true, difficulty: true } },
        },
      },
    },
  })
  if (!c) return null

  const now = new Date()
  const status = contestStatus(now, c.startsAt, c.endsAt)

  let problems: ContestProblemRow[] = []
  if (status !== 'UPCOMING') {
    // Which of these problems has this user solved within the contest.
    const solved = await prisma.codeSubmission.findMany({
      where: { userId, contestId: c.id, verdict: 'ACCEPTED' },
      distinct: ['problemId'],
      select: { problemId: true },
    })
    const solvedIds = new Set(solved.map((s) => s.problemId))
    problems = c.problems.map((cp) => ({
      order: cp.order,
      slug: cp.problem.slug,
      title: cp.problem.title,
      difficulty: cp.problem.difficulty,
      points: cp.points,
      solved: solvedIds.has(cp.problem.id),
    }))
  }

  const mine = await myContestScore(c.id, userId)
  return {
    slug: c.slug,
    title: c.title,
    description: c.description,
    author: { name: c.author.name, image: c.author.image },
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    status,
    problems,
    myRank: mine.rank,
    myPoints: mine.points,
  }
}

/**
 * A contest problem in the learner shape, but only while the contest is RUNNING.
 * Returns null (404) before it starts or after it ends — after it ends the
 * problem surfaces through the general /labs/code-lab route instead.
 */
export async function getContestProblemForLearner(
  contestSlug: string,
  problemSlug: string,
  userId: string,
): Promise<{ contest: { id: string; slug: string; title: string; endsAt: Date }; points: number; problem: LearnerProblem } | null> {
  const cp = await prisma.contestProblem.findFirst({
    where: { contest: { slug: contestSlug, published: true }, problem: { slug: problemSlug } },
    select: {
      points: true,
      contest: { select: { id: true, slug: true, title: true, startsAt: true, endsAt: true } },
      problem: true,
    },
  })
  if (!cp) return null
  if (contestStatus(new Date(), cp.contest.startsAt, cp.contest.endsAt) !== 'RUNNING') return null

  const problem = await buildLearnerProblem(cp.problem, userId)
  return {
    contest: { id: cp.contest.id, slug: cp.contest.slug, title: cp.contest.title, endsAt: cp.contest.endsAt },
    points: cp.points,
    problem,
  }
}

export interface StandingRow {
  userId: string
  name: string
  image: string | null
  points: number
  solved: number
  /** Time of the last problem-first-solve, for the tie-break. */
  lastAccept: Date | null
}

export interface Standings {
  rows: StandingRow[]
  you: { rank: number | null; points: number }
  meId: string
}

/**
 * ICPC-lite scoring for everyone with an accepted contest submission, sorted.
 * The ranking itself is pure (see contest-score.ts); this only feeds it the DB
 * rows. Names not attached.
 */
async function scoreContest(contestId: string): Promise<ScoredEntry[]> {
  const [contestProblems, accepted] = await Promise.all([
    prisma.contestProblem.findMany({ where: { contestId }, select: { problemId: true, points: true } }),
    prisma.codeSubmission.findMany({
      where: { contestId, verdict: 'ACCEPTED' },
      select: { userId: true, problemId: true, createdAt: true },
    }),
  ])
  return rankContest(contestProblems, accepted)
}

/** Ranked standings with user names/avatars, top N, plus the caller's own rank. */
export async function contestStandings(contestId: string, meId: string, limit = 50): Promise<Standings> {
  const scored = await scoreContest(contestId)

  const meIndex = scored.findIndex((s) => s.userId === meId)
  const you = { rank: meIndex >= 0 ? meIndex + 1 : null, points: meIndex >= 0 ? scored[meIndex].points : 0 }

  const top = scored.slice(0, limit)
  const users = await prisma.user.findMany({
    where: { id: { in: top.map((s) => s.userId) } },
    select: { id: true, name: true, image: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))
  const rows: StandingRow[] = top.map((s) => ({
    userId: s.userId,
    name: byId.get(s.userId)?.name ?? 'Learner',
    image: byId.get(s.userId)?.image ?? null,
    points: s.points,
    solved: s.solved,
    lastAccept: s.lastAccept,
  }))

  return { rows, you, meId }
}

/** Standings for a published contest addressed by slug. Null if no such contest. */
export async function contestStandingsBySlug(slug: string, meId: string, limit = 50): Promise<Standings | null> {
  const c = await prisma.contest.findFirst({ where: { slug, published: true }, select: { id: true } })
  if (!c) return null
  return contestStandings(c.id, meId, limit)
}

/** The caller's contest points + rank, ranked across everyone (not just top N). */
async function myContestScore(contestId: string, userId: string): Promise<{ rank: number | null; points: number }> {
  const scored = await scoreContest(contestId)
  const i = scored.findIndex((s) => s.userId === userId)
  return { rank: i >= 0 ? i + 1 : null, points: i >= 0 ? scored[i].points : 0 }
}

export interface GlobalRow {
  userId: string
  name: string
  image: string | null
  /** Named `xp` so the shared LeaderboardSheet renders it unchanged — it is the
   * distinct-problems-solved count, not XP. */
  xp: number
}

/** All-time global board: distinct Code Lab problems solved, most first. */
export async function globalCodeLabBoard(limit = 10): Promise<{ rows: GlobalRow[] }> {
  const grouped = await prisma.xpEvent.groupBy({
    by: ['userId'],
    where: { reason: CODE_LAB_SOLVED_REASON },
    _count: { _all: true },
  })
  if (grouped.length === 0) return { rows: [] }

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, name: true, image: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  const rows = grouped
    .map((g) => ({
      userId: g.userId,
      name: byId.get(g.userId)?.name ?? 'Learner',
      image: byId.get(g.userId)?.image ?? null,
      xp: g._count._all,
    }))
    .filter((r) => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)

  return { rows }
}

/** The caller's rank + solved count on the global board. */
export async function myGlobalRank(userId: string): Promise<{ rank: number | null; xp: number }> {
  const grouped = await prisma.xpEvent.groupBy({
    by: ['userId'],
    where: { reason: CODE_LAB_SOLVED_REASON },
    _count: { _all: true },
  })
  const mine = grouped.find((g) => g.userId === userId)?._count._all ?? 0
  if (mine <= 0) return { rank: null, xp: 0 }
  let ahead = 0
  for (const g of grouped) if (g._count._all > mine) ahead++
  return { rank: ahead + 1, xp: mine }
}
