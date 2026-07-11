// Grade a challenge submission. The user's code is run against the hidden tests
// stored on the attempt row; all timing/attempt limits are enforced here, not on
// the client. Never returns the tests or expected outputs.

import { requireUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/gamification/award'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'
import { grade, reward, streakMultiplier, MODE, type HiddenTest, type Mode } from '@/lib/visualizer/challenge'

export const runtime = 'nodejs'

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let attemptId = ''
  let code = ''
  try {
    const body = await request.json()
    if (typeof body?.attemptId === 'string') attemptId = body.attemptId
    if (typeof body?.code === 'string') code = body.code.slice(0, 8000)
  } catch {
    return fail('BAD_REQUEST', 'Invalid JSON body.', 400)
  }
  if (!attemptId) return fail('BAD_REQUEST', 'Missing attemptId.', 400)

  const attempt = await prisma.challengeAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
  if (!attempt) return fail('NOT_FOUND', 'Challenge not found.', 404)
  if (attempt.status !== 'active') return fail('NOT_ACTIVE', 'This challenge is already finished.', 409)

  const mode = attempt.mode as Mode
  const now = Date.now()

  // Timed mode: a lapsed clock stops grading — but the round is NOT lost yet.
  // The learner can pay to Resume (+5min & +1 life) or Give up. Keep it active.
  if (attempt.expiresAt && now > attempt.expiresAt.getTime()) {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } })
    return Response.json({ status: 'rescue', rescuable: 'time', reason: 'timeout', passed: 0, total: (attempt.tests as unknown as HiddenTest[]).length, xpDelta: 0, balance: me?.xp ?? 0 })
  }

  const tests = attempt.tests as unknown as HiddenTest[]
  const result = grade(code, attempt.fnName, tests)
  const attemptsUsed = attempt.attemptsUsed + 1

  // Win.
  if (result.allPass) {
    const remainingMs = attempt.expiresAt ? Math.max(0, attempt.expiresAt.getTime() - now) : 0
    const remainingFrac =
      attempt.expiresAt && MODE[mode].timerMs
        ? Math.max(0, remainingMs / MODE[mode].timerMs!)
        : 0
    // Clutch: a timed win with the clock nearly out — earns a bonus "moment".
    const clutch = mode === 'timed' && remainingMs > 0 && remainingMs < 15_000
    // Streak = consecutive wins ending with this one. Count finished rounds
    // newest-first, stop at the first loss. +1 for the win we're about to record.
    const recent = await prisma.challengeAttempt.findMany({
      where: { userId: user.id, status: { in: ['won', 'lost'] } },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
      take: 20,
    })
    let priorWins = 0
    for (const r of recent) { if (r.status === 'won') priorWins++; else break }
    const streak = priorWins + 1
    const multiplier = streakMultiplier(streak)
    const base = reward(mode, attempt.stake, attemptsUsed, remainingFrac)
    const xp = Math.round(base * multiplier)

    await prisma.challengeAttempt.update({
      where: { id: attempt.id },
      data: { status: 'won', attemptsUsed, wonXp: xp, winStreak: streak },
    })
    const award = await awardXp({
      userId: user.id,
      reason: 'viz_challenge_win',
      sourceId: attempt.id,
      amount: xp,
      meta: { difficulty: attempt.difficulty, mode },
    })
    return Response.json({
      status: 'won',
      attemptId: attempt.id,
      passed: result.passed,
      total: result.total,
      xpDelta: xp,
      winStreak: streak,
      multiplier,
      clutch,
      referenceSolution: attempt.referenceSolution,
      balance: award.totalXp,
      newBadges: award.newBadges,
      leveledUp: award.leveledUp,
      level: award.level,
    })
  }

  // Miss — decide whether the round is over.
  const outOfTries = attemptsUsed >= attempt.maxAttempts

  // Timed players who exhaust their tries (with clock still running) aren't lost:
  // they can buy a single extra life. Persist the used attempt, stay active.
  if (mode === 'timed' && outOfTries) {
    await prisma.challengeAttempt.update({ where: { id: attempt.id }, data: { attemptsUsed } })
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } })
    return Response.json({
      status: 'rescue',
      rescuable: 'life',
      passed: result.passed,
      total: result.total,
      xpDelta: 0,
      remainingAttempts: 0,
      expiresAt: attempt.expiresAt,
      balance: me?.xp ?? 0,
    })
  }

  const finalLoss = mode === 'oneshot' || outOfTries
  await prisma.challengeAttempt.update({
    where: { id: attempt.id },
    data: { status: finalLoss ? 'lost' : 'active', attemptsUsed },
  })
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } })
  return Response.json({
    status: finalLoss ? 'lost' : 'active',
    passed: result.passed,
    total: result.total,
    xpDelta: 0,
    remainingAttempts: Math.max(0, attempt.maxAttempts - attemptsUsed),
    expiresAt: attempt.expiresAt,
    balance: me?.xp ?? 0,
  })
}
