import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

// Saves the learner's 1-5 rating and optional comment for a support session.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/support/sessions/[id]/feedback'>) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const { id } = await ctx.params

  let rating = 0
  let feedback = ''
  try {
    const body = await request.json()
    if (typeof body?.rating === 'number') rating = Math.round(body.rating)
    if (typeof body?.feedback === 'string') feedback = body.feedback
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }

  if (rating < 1 || rating > 5) return errorResponse('SERVER_ERROR', 'Rating must be between 1 and 5.')

  const existing = await prisma.supportSession.findUnique({ where: { id }, select: { userId: true } })
  if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')

  await prisma.supportSession.update({
    where: { id },
    data: { rating, feedback: feedback.trim().slice(0, 1000) || null },
  })

  return Response.json({ ok: true })
}
