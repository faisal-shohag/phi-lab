// Check a Bug Hunt fix and pay out if the program is healthy again.
//
// Same shape as the practice-problem check: the code runs server-side in the
// sandbox, its console output is compared to the answer key, and the XP is
// awarded here. The key never leaves the server.
//
// Note on cheating: the goal line says what a fixed program prints, so a
// determined learner can delete the code and print those lines by hand. Accepted
// — this is a practice yard, not an exam, and the only person robbed is the one
// doing it. `requires` catches the lazy version (a level about `while` "fixed"
// with no `while` in sight) without pretending to be airtight.

import { requireUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/gamification/award'
import { bugById } from '@/lib/visualizer/bugs'
import { BUG_ANSWERS } from '@/lib/visualizer/bugs-expected'
import { runOutput, matchesExpected } from '@/lib/visualizer/problems-run'
import { bugFixXp } from '@/lib/gamification/reasons'

export const runtime = 'nodejs'

const MAX_CODE = 20_000

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED', 'Sign in to check your fix.', 401)

  let bugId = ''
  let code = ''
  try {
    const body = await request.json()
    if (typeof body?.bugId === 'string') bugId = body.bugId
    if (typeof body?.code === 'string') code = body.code.slice(0, MAX_CODE)
  } catch {
    return fail('BAD_REQUEST', 'Invalid JSON body.', 400)
  }

  const level = bugById(bugId)
  if (!level) return fail('UNKNOWN_BUG', 'That is not a bug hunt level.', 400)

  const answer = BUG_ANSWERS[level.id]
  if (!answer) return fail('NO_ANSWER_KEY', 'This level has no answer key yet.', 500)

  if (!code.trim()) return fail('EMPTY', 'There is no code to check.', 400)

  // The nudge guard, before spending a sandbox run on it.
  const missing = (level.requires ?? []).filter((needle) => !code.includes(needle))
  if (missing.length > 0) {
    return Response.json({
      passed: false,
      reason: 'REQUIRES',
      message: `Keep using ${missing.map((m) => `\`${m}\``).join(' and ')} — fix the bug, don't rewrite around it.`,
      expected: answer.expected,
      got: null,
    })
  }

  const run = await runOutput(code)
  if (run.lines === null) {
    return Response.json({
      passed: false,
      reason: 'ERROR',
      message: run.error ?? 'The program still does not run.',
      expected: answer.expected,
      got: null,
    })
  }

  if (!matchesExpected(run.lines, answer.expected)) {
    return Response.json({
      passed: false,
      reason: 'MISMATCH',
      message: 'Still buggy — the output does not match yet.',
      expected: answer.expected,
      got: run.lines,
    })
  }

  const result = await awardXp({
    userId: user.id,
    reason: 'viz_bug_fixed',
    sourceId: `bug:${level.id}`,
    amount: bugFixXp(level.difficulty),
    meta: { bugId: level.id, topicId: level.topicId, difficulty: level.difficulty },
  })

  return Response.json({
    passed: true,
    expected: answer.expected,
    got: run.lines,
    // 0 on a re-check of an already-fixed level — the ledger is idempotent.
    xpGained: result.xpGained,
    totalXp: result.totalXp,
    newBadges: result.newBadges,
    leveledUp: result.leveledUp,
    level: result.level,
  })
}
