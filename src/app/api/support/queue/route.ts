import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { claimSlots } from '@/lib/support/queue'

// Poll endpoint for a waiting/active session. Doubles as the heartbeat: each
// call refreshes lastSeenAt and runs the promote/reclaim pass, then returns this
// session's { status, position }.
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return errorResponse('NOT_FOUND', 'No session id provided.')

  const session = await prisma.supportSession.findUnique({ where: { id }, select: { userId: true } })
  if (!session || session.userId !== user.id) return errorResponse('NOT_FOUND')

  const result = await claimSlots(id)
  return Response.json(result)
}
