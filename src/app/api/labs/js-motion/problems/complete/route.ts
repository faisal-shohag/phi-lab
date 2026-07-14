// Check a practice problem submission and pay out if it's right.
//
// The learner's program is run server-side in the sandbox and its console output
// compared to the answer key. The key never leaves the server, and the XP is
// awarded here rather than by the client, because this result feeds the
// Challenge gate — a client-granted receipt would make the gate self-issued.
//
// Note on cheating: the goal line tells the learner what to print, so a
// determined student can hardcode console.log and pass. That is accepted. This
// gate paces the curriculum, it does not certify anyone, and the person cheated
// is the one doing it. `requires` catches the lazy version of that (a loop
// problem solved with no loop) without pretending to be airtight.

import { requireUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/gamification/award'
import { problemById } from '@/lib/visualizer/problems'
import { PROBLEM_ANSWERS } from '@/lib/visualizer/problems-expected'
import { runOutput, matchesExpected } from '@/lib/visualizer/problems-run'
import { PRACTICE_PROBLEM_XP } from '@/lib/gamification/reasons'

export const runtime = 'nodejs'

const MAX_CODE = 20_000

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED', 'Sign in to check your solution.', 401)

  let problemId = ''
  let code = ''
  try {
    const body = await request.json()
    if (typeof body?.problemId === 'string') problemId = body.problemId
    if (typeof body?.code === 'string') code = body.code.slice(0, MAX_CODE)
  } catch {
    return fail('BAD_REQUEST', 'Invalid JSON body.', 400)
  }

  const problem = problemById(problemId)
  if (!problem || problem.kind !== 'practice') {
    return fail('UNKNOWN_PROBLEM', 'That is not a practice problem.', 400)
  }
  const answer = PROBLEM_ANSWERS[problem.id]
  if (!answer) return fail('NO_ANSWER_KEY', 'This problem has no answer key yet.', 500)

  if (!code.trim()) return fail('EMPTY', 'Write some code first.', 400)

  // The nudge guard, before spending a sandbox run on it.
  const missing = (problem.requires ?? []).filter((needle) => !code.includes(needle))
  if (missing.length > 0) {
    return Response.json({
      passed: false,
      reason: 'REQUIRES',
      message: `This one is about ${missing.map((m) => `\`${m}\``).join(' and ')} — use it in your solution.`,
      expected: answer.expected,
      got: null,
    })
  }

  const run = await runOutput(code)
  if (run.lines === null) {
    return Response.json({
      passed: false,
      reason: 'ERROR',
      message: run.error ?? 'Your code did not run.',
      expected: answer.expected,
      got: null,
    })
  }

  if (!matchesExpected(run.lines, answer.expected)) {
    return Response.json({
      passed: false,
      reason: 'MISMATCH',
      message: 'Close — the output does not match yet.',
      expected: answer.expected,
      got: run.lines,
    })
  }

  const result = await awardXp({
    userId: user.id,
    reason: 'viz_problem',
    sourceId: `problem:${problem.id}`,
    amount: PRACTICE_PROBLEM_XP,
    meta: { problemId: problem.id, topicId: problem.topicId, kind: 'practice' },
  })

  return Response.json({
    passed: true,
    expected: answer.expected,
    got: run.lines,
    // 0 on a re-check of an already-solved problem — the ledger is idempotent.
    xpGained: result.xpGained,
    totalXp: result.totalXp,
    newBadges: result.newBadges,
    leveledUp: result.leveledUp,
    level: result.level,
  })
}
