// Blitz (timed) rescues. Two paid, unlimited, flat-price top-ups on an active
// timed round:
//   kind 'time' — the clock has run out: pay RESUME_TIME_COST for +5 minutes
//                 AND +1 life (extra attempt).
//   kind 'life' — tries are exhausted but the clock is still running: pay
//                 RESUME_LIFE_COST for +1 attempt, no extra time.
// All timing/state is enforced here; the client only asks.

import { randomUUID } from 'node:crypto'
import { requireUser } from '@/lib/auth-server'
import { spendXp } from '@/lib/gamification/award'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'
import { RESUME_TIME_COST, RESUME_LIFE_COST, RESUME_TIME_MS } from '@/lib/visualizer/challenge'

export const runtime = 'nodejs'

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let attemptId = ''
  let kind: 'time' | 'life' = 'time'
  try {
    const body = await request.json()
    if (typeof body?.attemptId === 'string') attemptId = body.attemptId
    if (body?.kind === 'life') kind = 'life'
  } catch {
    return fail('BAD_REQUEST', 'Invalid JSON body.', 400)
  }
  if (!attemptId) return fail('BAD_REQUEST', 'Missing attemptId.', 400)

  const attempt = await prisma.challengeAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
  if (!attempt) return fail('NOT_FOUND', 'Challenge not found.', 404)
  if (attempt.status !== 'active') return fail('NOT_ACTIVE', 'This challenge is already finished.', 409)
  if (attempt.mode !== 'timed' || !attempt.expiresAt) return fail('NOT_TIMED', 'Only Blitz rounds can be resumed.', 409)

  const now = Date.now()
  const expired = now > attempt.expiresAt.getTime()

  if (kind === 'time') {
    // Only valid once the clock has actually run out.
    if (!expired) return fail('NOT_EXPIRED', 'The clock is still running.', 409)
    const spent = await spendXp({ userId: user.id, reason: 'viz_challenge_resume', sourceId: randomUUID(), amount: RESUME_TIME_COST })
    if (!spent.spent) return fail('INSUFFICIENT_XP', `You need ${RESUME_TIME_COST} XP to resume.`, 400)
    const updated = await prisma.challengeAttempt.update({
      where: { id: attempt.id },
      data: { expiresAt: new Date(now + RESUME_TIME_MS), maxAttempts: { increment: 1 } },
      select: { expiresAt: true, maxAttempts: true, attemptsUsed: true },
    })
    return Response.json({ attemptId: attempt.id, ...updated, balance: spent.balance })
  }

  // kind === 'life': tries must be exhausted and time must remain.
  if (expired) return fail('EXPIRED', 'Time is up — resume the clock instead.', 409)
  if (attempt.attemptsUsed < attempt.maxAttempts) return fail('HAS_TRIES', 'You still have tries left.', 409)
  const spent = await spendXp({ userId: user.id, reason: 'viz_challenge_life', sourceId: randomUUID(), amount: RESUME_LIFE_COST })
  if (!spent.spent) return fail('INSUFFICIENT_XP', `You need ${RESUME_LIFE_COST} XP to buy a life.`, 400)
  const updated = await prisma.challengeAttempt.update({
    where: { id: attempt.id },
    data: { maxAttempts: { increment: 1 } },
    select: { expiresAt: true, maxAttempts: true, attemptsUsed: true },
  })
  return Response.json({ attemptId: attempt.id, ...updated, balance: spent.balance })
}
