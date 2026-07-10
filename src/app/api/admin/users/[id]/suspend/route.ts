// POST   /api/admin/users/:id/suspend  { reason }  -> suspend
// DELETE /api/admin/users/:id/suspend             -> lift the suspension
//
// Suspension is enforced by DB reads at the choke points (getHiveUser and the
// lab token routes), NOT by the session cookie, which better-auth caches for 30
// days. suspendUser also deletes the user's Session rows as a second line.
import { withAdmin } from '@/lib/admin/guard'
import { suspendUser, unsuspendUser } from '@/lib/admin/users'
import { hiveError } from '@/lib/hive/errors'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (actor) => {
    const { id } = await params

    let reason = ''
    try {
      const body = await request.json()
      if (typeof body?.reason === 'string') reason = body.reason.trim()
    } catch {
      return hiveError('VALIDATION', 'Invalid JSON body.')
    }

    if (!reason) return hiveError('VALIDATION', 'A reason is required to suspend an account.')

    await suspendUser(actor.id, id, reason)
    return Response.json({ ok: true })
  })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (actor) => {
    const { id } = await params
    await unsuspendUser(actor.id, id)
    return Response.json({ ok: true })
  })
}
