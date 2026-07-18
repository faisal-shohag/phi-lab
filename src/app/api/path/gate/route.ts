import { requireUser } from '@/lib/auth-server'
import { isSuspended } from '@/lib/admin/suspension'
import { startGate, submitGate } from '@/lib/path/gate'

// Jump-forward gate. POST { action: 'start', nodeId } mints a probe; POST
// { action: 'submit', nodeId, token, answers } grades it and, on pass, banks the
// node's prerequisites so it unlocks. All grading is server-side from the signed
// token — the client never sees the correct answers.
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  if (await isSuspended(user.id)) return Response.json({ error: 'SUSPENDED' }, { status: 403 })

  let body: { action?: string; nodeId?: unknown; token?: unknown; answers?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  if (typeof body.nodeId !== 'string') return Response.json({ error: 'BAD_NODE' }, { status: 400 })

  if (body.action === 'start') {
    const result = await startGate(user.id, body.nodeId)
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' || result.error === 'NO_GATE' ? 400 : 502
      return Response.json({ error: result.error }, { status })
    }
    return Response.json(result.probe)
  }

  if (body.action === 'submit') {
    if (typeof body.token !== 'string') return Response.json({ error: 'BAD_TOKEN' }, { status: 400 })
    const answers = Array.isArray(body.answers)
      ? body.answers.map((a) => (typeof a === 'number' ? a : -1))
      : []
    const result = await submitGate(user.id, body.nodeId, body.token, answers)
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 })
    return Response.json(result)
  }

  return Response.json({ error: 'BAD_ACTION' }, { status: 400 })
}
