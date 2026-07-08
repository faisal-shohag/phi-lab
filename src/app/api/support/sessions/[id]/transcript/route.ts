import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

interface TurnEntry {
  role: 'agent' | 'student'
  text: string
}

// Persists the running support transcript and doubles as the live heartbeat
// (refreshes lastSeenAt) so an active session keeps its slot while connected.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/support/sessions/[id]/transcript'>) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const { id } = await ctx.params

  let transcript: TurnEntry[] = []
  let ended = false
  try {
    const body = await request.json()
    if (Array.isArray(body?.transcript)) transcript = body.transcript
    if (typeof body?.ended === 'boolean') ended = body.ended
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }

  const existing = await prisma.supportSession.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')

  await prisma.supportSession.update({
    where: { id },
    data: {
      transcript: transcript as unknown as object,
      lastSeenAt: new Date(),
      ...(ended && !existing.endedAt ? { endedAt: new Date() } : {}),
    },
  })

  return Response.json({ ok: true })
}
