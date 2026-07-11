// Forfeit the current challenge. The stake was already spent on activate, so
// giving up just closes the round as a loss.

import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let attemptId = ''
  try {
    const body = await request.json()
    if (typeof body?.attemptId === 'string') attemptId = body.attemptId
  } catch {
    return Response.json({ error: 'BAD_REQUEST', message: 'Invalid JSON body.' }, { status: 400 })
  }

  const attempt = await prisma.challengeAttempt.findFirst({ where: { id: attemptId, userId: user.id, status: 'active' } })
  if (!attempt) return Response.json({ error: 'NOT_FOUND', message: 'No active challenge.' }, { status: 404 })

  await prisma.challengeAttempt.update({ where: { id: attempt.id }, data: { status: 'lost' } })
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } })
  return Response.json({ status: 'lost', balance: me?.xp ?? 0 })
}
