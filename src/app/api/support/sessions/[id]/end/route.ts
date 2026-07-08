import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { supportXp } from '@/lib/gamification/reasons'

// Ends a support session: marks it completed (which frees its slot immediately)
// and awards a small, idempotent XP grant. No AI report is generated.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/support/sessions/[id]/end'>) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const { id } = await ctx.params

  const existing = await prisma.supportSession.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')

  if (existing.status !== 'completed') {
    await prisma.supportSession.update({
      where: { id },
      data: { status: 'completed', endedAt: existing.endedAt ?? new Date() },
    })
  }

  try {
    await awardXp({
      userId: user.id,
      reason: 'support_completed',
      sourceId: id,
      amount: supportXp(),
      meta: { category: existing.category },
    })
  } catch {
    // XP is best-effort.
  }

  return Response.json({ ok: true })
}
