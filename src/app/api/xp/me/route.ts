import { requireUser } from '@/lib/auth-server'
import { getProfile } from '@/lib/gamification/award'

// Current learner's XP standing: total XP, unlocked badge ids, and the raw
// stats behind badge progress. Drives the nav badge and the achievements page.
export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const profile = await getProfile(user.id)
  return Response.json(profile)
}
