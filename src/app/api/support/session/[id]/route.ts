import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

// Leaves the queue (or ends a not-yet-completed session) — marks it abandoned so
// its slot, if any, frees immediately.
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/support/session/[id]'>) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const { id } = await ctx.params

  const existing = await prisma.supportSession.findUnique({ where: { id }, select: { userId: true, status: true } })
  if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')

  if (existing.status === 'waiting' || existing.status === 'active') {
    await prisma.supportSession.update({
      where: { id },
      data: { status: 'abandoned', endedAt: new Date() },
    })
  }

  return Response.json({ ok: true })
}
