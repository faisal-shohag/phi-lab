// Resume the learner's current active challenge (e.g. after a refresh). Returns
// only client-safe fields — never the hidden tests or expected outputs. A timed
// round whose clock has already lapsed is closed as a loss here so a stale tab
// can't keep playing.

import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const attempt = await prisma.challengeAttempt.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!attempt) return Response.json({ active: null })

  if (attempt.expiresAt && Date.now() > attempt.expiresAt.getTime()) {
    await prisma.challengeAttempt.update({ where: { id: attempt.id }, data: { status: 'lost' } })
    return Response.json({ active: null, expired: attempt.id })
  }

  // Current win streak entering this round — consecutive prior wins, newest-first.
  const recent = await prisma.challengeAttempt.findMany({
    where: { userId: user.id, status: { in: ['won', 'lost'] } },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
    take: 20,
  })
  let currentStreak = 0
  for (const r of recent) { if (r.status === 'won') currentStreak++; else break }

  return Response.json({
    active: {
      attemptId: attempt.id,
      difficulty: attempt.difficulty,
      mode: attempt.mode,
      lang: attempt.lang,
      stake: attempt.stake,
      fnName: attempt.fnName,
      prompt: attempt.prompt,
      sample: { input: attempt.sampleInput, output: attempt.sampleOutput },
      maxAttempts: attempt.maxAttempts,
      attemptsUsed: attempt.attemptsUsed,
      hintsUsed: attempt.hintsUsed,
      currentStreak,
      expiresAt: attempt.expiresAt,
    },
  })
}
