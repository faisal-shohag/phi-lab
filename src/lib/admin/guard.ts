// Guard for /api/admin/* route handlers.
//
// The (admin) layout redirects non-admins away from the *pages*. That says
// nothing about the API: a layout cannot stop a fetch. Every admin route
// re-checks for itself, and this wrapper is how it does so without each handler
// re-implementing the same three lines (and eventually forgetting one).
import { requireAdmin } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { AdminActionError } from './errors'

interface AdminActor {
  id: string
  name: string
  email: string
}

/**
 * Runs `handler` only for a signed-in ADMIN. Translates AdminActionError (the
 * role/suspension guardrails) into the matching HTTP status, so guardrail
 * violations read as 403/409 rather than a 500.
 */
export async function withAdmin(
  handler: (actor: AdminActor) => Promise<Response>,
): Promise<Response> {
  const { user, error } = await requireAdmin()
  if (error) return hiveError(error)

  try {
    return await handler({ id: user.id, name: user.name, email: user.email })
  } catch (err) {
    if (err instanceof AdminActionError) return hiveError(err.code, err.message)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return hiveError('SERVER_ERROR', message)
  }
}
