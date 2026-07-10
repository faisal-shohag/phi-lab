// Mentor-only view of the AI fleet: which providers are configured, which are
// parked (rate limited or rejected key) and for how long, and what the last
// error from each was. Handy when the Hive suddenly starts escalating.
import { requireMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { providerHealth } from '@/lib/hive/providers'

export async function GET() {
  const { error } = await requireMentor()
  if (error) return hiveError(error)

  return Response.json({ providers: providerHealth() })
}
