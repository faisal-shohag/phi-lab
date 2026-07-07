import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

// Delete an analogy card from your deck (owner only).
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/analogies/[id]'>) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const { id } = await ctx.params
  const existing = await prisma.analogyCard.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')

  await prisma.analogyCard.delete({ where: { id } })
  return Response.json({ ok: true })
}
