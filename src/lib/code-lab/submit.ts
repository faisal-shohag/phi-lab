// Server-only submit pipeline: transpile → grade every case in the sandbox →
// log the attempt → award XP on a first accept. The single source of truth for a
// verdict and for XP; the browser "Run" never touches this.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { toRunnableJs, CompileError } from './transpile'
import { gradeAll, type GradeInput } from './grade-qjs'
import { CODE_LAB_SOLVED_REASON } from './xp'
import { contestStatus } from './contest-status'
import type { CodeLanguage, ProblemTests, SubmitResponse } from './types'

const MAX_CODE = 50_000

export async function submitSolution(
  userId: string,
  problemId: string,
  language: CodeLanguage,
  code: string,
  contestId?: string,
): Promise<SubmitResponse | { error: 'NOT_FOUND' | 'VALIDATION'; message: string }> {
  if (typeof code !== 'string' || code.length === 0) return { error: 'VALIDATION', message: 'No code submitted.' }
  if (code.length > MAX_CODE) return { error: 'VALIDATION', message: 'Solution is too large.' }

  // A contest problem lives behind published=false, so don't require published
  // when submitting inside its running contest — validate membership instead.
  const problem = await prisma.problem.findFirst({
    where: contestId ? { id: problemId } : { id: problemId, published: true },
  })
  if (!problem) return { error: 'NOT_FOUND', message: 'Problem not found.' }
  if (!problem.languages.includes(language)) {
    return { error: 'VALIDATION', message: 'This problem cannot be solved in that language.' }
  }

  // Contest submit: the window must be RUNNING and the problem must belong to
  // this contest. Never trust the client's clock or claimed membership.
  if (contestId) {
    const contest = await prisma.contest.findFirst({
      where: { id: contestId, published: true },
      select: { startsAt: true, endsAt: true, problems: { where: { problemId }, select: { problemId: true } } },
    })
    if (!contest || contest.problems.length === 0) return { error: 'NOT_FOUND', message: 'Contest problem not found.' }
    if (contestStatus(new Date(), contest.startsAt, contest.endsAt) !== 'RUNNING') {
      return { error: 'VALIDATION', message: 'This contest is not currently running.' }
    }
  }

  const tests = (problem.tests as unknown as ProblemTests | null) ?? { cases: [] }
  const input: GradeInput = { type: problem.type, fnName: problem.fnName, tests }

  // Transpile server-side; a TS error is its own verdict (never grades).
  let codeJs: string
  try {
    codeJs = toRunnableJs(code, language)
  } catch (err) {
    const message = err instanceof CompileError ? err.message : 'Failed to compile.'
    return finalize(userId, problem.id, language, code, {
      verdict: 'COMPILE_ERROR',
      results: [],
      passedCount: 0,
      totalCount: tests.cases.length,
      runtimeMs: 0,
      error: message,
    }, tests, contestId)
  }

  const summary = await gradeAll(codeJs, input, false)
  return finalize(userId, problem.id, language, code, summary, tests, contestId, problem.xp, problem.difficulty)
}

async function finalize(
  userId: string,
  problemId: string,
  language: CodeLanguage,
  code: string,
  summary: Awaited<ReturnType<typeof gradeAll>>,
  tests: ProblemTests,
  contestId?: string,
  problemXp?: number,
  difficulty?: string,
): Promise<SubmitResponse> {
  // Persist visible-case results so the submissions view can replay this run's
  // actual input/output. Hidden cases are excluded — never stored client-visible.
  const visibleResults = summary.results.filter((r) => !r.hidden)

  await prisma.codeSubmission.create({
    data: {
      userId,
      problemId,
      language,
      code,
      verdict: summary.verdict,
      passedCount: summary.passedCount,
      totalCount: summary.totalCount,
      results: visibleResults as unknown as object,
      runtimeMs: summary.runtimeMs,
      error: summary.error?.slice(0, 500) ?? null,
      contestId: contestId ?? null,
    },
  })

  let xp: SubmitResponse['xp']
  if (summary.verdict === 'ACCEPTED' && problemXp !== undefined) {
    const award = await awardXp({
      userId,
      reason: CODE_LAB_SOLVED_REASON,
      sourceId: problemId,
      amount: problemXp,
      meta: { problemId, difficulty },
    })
    xp = {
      awarded: award.awarded,
      xpGained: award.xpGained,
      totalXp: award.totalXp,
      level: award.level,
      leveledUp: award.leveledUp,
      newBadges: award.newBadges,
    }
  }

  // Split visible vs hidden. Hidden cases surface only as counts — never the
  // inputs or expected outputs.
  const hiddenIds = new Set(tests.cases.filter((c) => c.hidden).map((c) => c.id))
  const hiddenResults = summary.results.filter((r) => hiddenIds.has(r.id))
  const hiddenPassed = hiddenResults.filter((r) => r.status === 'pass').length

  return {
    verdict: summary.verdict,
    passedCount: summary.passedCount,
    totalCount: summary.totalCount,
    visibleResults,
    hidden: { passed: hiddenPassed, total: hiddenResults.length },
    error: summary.error,
    xp,
  }
}
