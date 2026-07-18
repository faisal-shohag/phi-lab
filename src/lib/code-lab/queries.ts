// Server-only Code Lab reads. Keeps the server-only contract: the learner-facing
// shapes here never carry solutionJs or hidden cases.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { CODE_LAB_SOLVED_REASON } from './xp'
import { paramNames } from './params'
import type {
  CaseResult,
  CodeLanguage,
  ProblemDifficulty,
  ProblemType,
  ProblemTests,
  SubmissionVerdict,
  VisibleCase,
} from './types'

export type ProblemStatus = 'solved' | 'attempted' | 'todo'

export interface ProblemListItem {
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  tags: string[]
  xp: number
  status: ProblemStatus
}

/** Published problems with this user's per-problem status, ready for the list. */
export async function listProblemsForUser(userId: string): Promise<ProblemListItem[]> {
  const [problems, solved, attempted] = await Promise.all([
    prisma.problem.findMany({
      // Exclude problems locked inside a contest that hasn't finished yet — they
      // live behind the contest route until endsAt passes, then appear here.
      where: { published: true, NOT: { contestProblem: { contest: { endsAt: { gt: new Date() } } } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, slug: true, title: true, difficulty: true, type: true, tags: true, xp: true },
    }),
    solvedProblemIds(userId),
    attemptedProblemIds(userId),
  ])

  return problems.map((p) => ({
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    type: p.type,
    tags: p.tags,
    xp: p.xp,
    status: solved.has(p.id) ? 'solved' : attempted.has(p.id) ? 'attempted' : 'todo',
  }))
}

export interface LearnerProblem {
  id: string
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  description: string
  constraints: string[]
  hints: string[]
  tags: string[]
  fnName: string | null
  /** Languages this problem may be solved in. */
  languages: CodeLanguage[]
  /** Entry-function parameter names, for labeling testcase inputs. */
  paramNames: string[]
  starterJs: string
  starterTs: string
  xp: number
  /** Visible sample cases only — hidden cases and the solution never ship. */
  sampleCases: VisibleCase[]
  solved: boolean
}

/** Cosmetic solve/attempt counts, streamed in after the workspace paints. */
export interface ProblemStats {
  /** Distinct learners who have solved this problem. */
  solvedCount: number
  /** Distinct learners who have submitted at least once. */
  attemptCount: number
}

/** A single published problem, stripped for the learner. Null if not found. */
export async function getLearnerProblem(slug: string, userId: string): Promise<LearnerProblem | null> {
  const p = await prisma.problem.findFirst({
    where: { slug, published: true },
    include: { contestProblem: { include: { contest: { select: { endsAt: true } } } } },
  })
  if (!p) return null
  // Locked inside a not-yet-finished contest: only reachable via the contest
  // route, never this general one.
  if (p.contestProblem && p.contestProblem.contest.endsAt.getTime() > Date.now()) return null

  return buildLearnerProblem(p, userId)
}

/**
 * Build the learner-facing shape from a full Problem row, stripping the solution
 * and hidden cases. Shared by the general problem route and the in-contest route.
 */
export async function buildLearnerProblem(
  p: {
    id: string; slug: string; title: string; difficulty: ProblemDifficulty; type: ProblemType
    description: string; constraints: string[]; hints: string[]; tags: string[]
    fnName: string | null; languages: CodeLanguage[]; starterJs: string; starterTs: string
    xp: number; tests: unknown
  },
  userId: string,
): Promise<LearnerProblem> {
  const tests = (p.tests as unknown as ProblemTests | null) ?? { cases: [] }
  const sampleCases: VisibleCase[] = tests.cases
    .filter((c) => !c.hidden)
    .map((c) => ({ id: c.id, args: c.args, expected: c.expected, expectedStdout: c.expectedStdout }))

  // Only the cheap per-user solved lookup is on the critical path; the aggregate
  // solve/attempt counts are streamed separately via getProblemStats so they
  // never block the editor from painting.
  const solved = await isSolved(userId, p.id)

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    type: p.type,
    description: p.description,
    constraints: p.constraints,
    hints: p.hints,
    tags: p.tags,
    fnName: p.fnName,
    languages: p.languages.length > 0 ? p.languages : ['JAVASCRIPT', 'TYPESCRIPT'],
    paramNames: paramNames(p.starterJs, p.fnName),
    starterJs: p.starterJs,
    starterTs: p.starterTs,
    xp: p.xp,
    sampleCases,
    solved,
  }
}

/**
 * Aggregate solver/attempt counts for the problem header. Deliberately separate
 * from buildLearnerProblem so the workspace can render before these resolve.
 */
export async function getProblemStats(problemId: string): Promise<ProblemStats> {
  const [solvedCount, attemptRows] = await Promise.all([
    // One XpEvent per (user, problem) by the unique constraint, so a plain count
    // is the distinct-solver count.
    prisma.xpEvent.count({ where: { reason: CODE_LAB_SOLVED_REASON, sourceId: problemId } }),
    prisma.codeSubmission.findMany({ where: { problemId }, distinct: ['userId'], select: { userId: true } }),
  ])
  return { solvedCount, attemptCount: attemptRows.length }
}

export interface SubmissionListItem {
  id: string
  language: CodeLanguage
  verdict: SubmissionVerdict
  passedCount: number
  totalCount: number
  runtimeMs: number | null
  createdAt: Date
}

/** This user's recent submissions for one problem, newest first. */
export async function listUserSubmissions(userId: string, problemId: string): Promise<SubmissionListItem[]> {
  const rows = await prisma.codeSubmission.findMany({
    where: { userId, problemId },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, language: true, verdict: true, passedCount: true, totalCount: true, runtimeMs: true, createdAt: true },
  })
  return rows
}

export interface SubmissionDetail extends SubmissionListItem {
  code: string
  error: string | null
  /** Per-visible-case results captured at grade time. Null on old rows. */
  results: CaseResult[] | null
}

/** One of the user's own submissions, with the code. Null if not theirs. */
export async function getSubmissionDetail(userId: string, id: string): Promise<SubmissionDetail | null> {
  const row = await prisma.codeSubmission.findFirst({
    where: { id, userId },
    select: {
      id: true,
      language: true,
      verdict: true,
      passedCount: true,
      totalCount: true,
      runtimeMs: true,
      createdAt: true,
      code: true,
      error: true,
      results: true,
    },
  })
  if (!row) return null
  const { results, ...rest } = row
  return { ...rest, results: (results as unknown as CaseResult[] | null) ?? null }
}

export interface CodeLabProfileStats {
  total: number
  byDifficulty: Record<ProblemDifficulty, number>
  recent: { slug: string; title: string; difficulty: ProblemDifficulty; at: Date }[]
}

/** Solved counts by difficulty + recent accepts, for the profile section. */
export async function getCodeLabProfileStats(userId: string): Promise<CodeLabProfileStats> {
  const events = await prisma.xpEvent.findMany({
    where: { userId, reason: CODE_LAB_SOLVED_REASON },
    select: { sourceId: true, meta: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const byDifficulty: Record<ProblemDifficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0, EXTRA_HARD: 0 }
  const solvedIds = events.map((e) => e.sourceId)
  for (const e of events) {
    const d = (e.meta as { difficulty?: ProblemDifficulty } | null)?.difficulty
    if (d && d in byDifficulty) byDifficulty[d]++
  }

  const recentIds = solvedIds.slice(0, 5)
  const problems = recentIds.length
    ? await prisma.problem.findMany({
        where: { id: { in: recentIds } },
        select: { id: true, slug: true, title: true, difficulty: true },
      })
    : []
  const byId = new Map(problems.map((p) => [p.id, p]))
  const recent = events
    .slice(0, 5)
    .map((e) => {
      const p = byId.get(e.sourceId)
      return p ? { slug: p.slug, title: p.title, difficulty: p.difficulty, at: e.createdAt } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return { total: events.length, byDifficulty, recent }
}

async function solvedProblemIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.xpEvent.findMany({
    where: { userId, reason: CODE_LAB_SOLVED_REASON },
    select: { sourceId: true },
  })
  return new Set(rows.map((r) => r.sourceId))
}

async function attemptedProblemIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.codeSubmission.findMany({
    where: { userId },
    select: { problemId: true },
    distinct: ['problemId'],
  })
  return new Set(rows.map((r) => r.problemId))
}

async function isSolved(userId: string, problemId: string): Promise<boolean> {
  const row = await prisma.xpEvent.findUnique({
    where: { userId_reason_sourceId: { userId, reason: CODE_LAB_SOLVED_REASON, sourceId: problemId } },
    select: { id: true },
  })
  return row !== null
}
