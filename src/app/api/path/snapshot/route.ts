import { requireUser } from '@/lib/auth-server'
import { getPathSnapshot } from '@/lib/path/snapshot'

// Re-read the learner's path. Called by the map after they come back from a lab,
// so a step they just finished flips to done and any newly-mastered node banks
// its XP — all of which syncPath does inside getPathSnapshot.
export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const snapshot = await getPathSnapshot(user.id)
  return Response.json(snapshot)
}
