import { requireUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/gamification/award'
import { resolveClientAward, type ClientAwardRequest } from '@/lib/gamification/reasons'

// Client-triggered XP grants (currently: correct predict-the-output quizzes).
// The amount is decided server-side from the reason; the client only names what
// happened and supplies a stable sourceId so retries can't double-count.
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  let body: ClientAwardRequest
  try {
    body = (await request.json()) as ClientAwardRequest
  } catch {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  if (!body?.reason || typeof body.sourceId !== 'string' || !body.sourceId) {
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const resolved = resolveClientAward(body)
  if (!resolved) return Response.json({ error: 'UNKNOWN_REASON' }, { status: 400 })

  const result = await awardXp({
    userId: user.id,
    reason: body.reason,
    sourceId: body.sourceId,
    amount: resolved.amount,
    meta: resolved.meta,
  })
  return Response.json(result)
}
