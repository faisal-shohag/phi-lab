// GET /api/me — the caller's own role, for UI that branches on it (the nav
// badge and the Admin link in the user menu).
//
// Why a request instead of reading it off the session: better-auth's session
// user has no `role` (it is a column Hive added), and its cookie cache would
// serve a stale role for hours after a promotion. This reads the database
// through getHiveUser(), so a role change shows up on the next page load — and
// a suspended account resolves to null, exactly as everywhere else.
//
// Nothing here is a security boundary. /admin is gated by requireAdmin() in its
// layout and every /api/admin route re-checks for itself; hiding the link only
// keeps it out of the way of people who cannot use it.
import { getHiveUser } from '@/lib/hive/roles'

export async function GET() {
  const user = await getHiveUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  return Response.json({ role: user.role })
}
