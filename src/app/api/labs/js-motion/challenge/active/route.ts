// Resume the learner's current active challenge (e.g. after a refresh). Returns
// only client-safe fields — never the hidden tests or expected outputs.
//
// A Blitz round whose clock has lapsed comes back with `rescuable: 'time'`
// rather than being closed as a loss: refreshing during the "Time's up —
// Resume?" prompt used to forfeit the stake, which made a page reload cost real
// XP. It stays open only until the grace window runs out (see closeIfAbandoned).
//
// A stale tab still can't play on: `submit` refuses to grade a lapsed clock and
// short-circuits to the same rescue offer. Nothing here is trusted for timing.

import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'
import { closeIfAbandoned } from '@/lib/visualizer/challenge-state'
import { rescuableFor } from '@/lib/visualizer/challenge'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const attempt = await prisma.challengeAttempt.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!attempt) return Response.json({ active: null })

  if (await closeIfAbandoned(attempt)) {
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
    // Set when the round can't be played until the learner pays: the page opens
    // the rescue overlay instead of the arena.
    rescuable: rescuableFor(attempt),
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
