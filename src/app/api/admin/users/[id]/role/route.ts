// PATCH /api/admin/users/:id/role  { role: "STUDENT" | "MENTOR" | "ADMIN" }
//
// Guardrails (enforced in setUserRole, not here): you cannot change your own
// role, and you cannot demote the last remaining admin. Both are unrecoverable
// from inside the app.
import { withAdmin } from '@/lib/admin/guard'
import { setUserRole } from '@/lib/admin/users'
import { hiveError } from '@/lib/hive/errors'
import type { Role } from '@/generated/prisma/client'

const ROLES: Role[] = ['STUDENT', 'MENTOR', 'ADMIN']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (actor) => {
    const { id } = await params

    let role: unknown
    try {
      role = (await request.json())?.role
    } catch {
      return hiveError('VALIDATION', 'Invalid JSON body.')
    }

    if (typeof role !== 'string' || !ROLES.includes(role as Role)) {
      return hiveError('VALIDATION', `Role must be one of: ${ROLES.join(', ')}.`)
    }

    await setUserRole(actor.id, id, role as Role)
    return Response.json({ ok: true })
  })
}
