// Mentor-only view of the AI fleet: which providers are configured, which keys
// each one has, and which of those keys are parked (rate limited or rejected) and
// for how long. Handy when the Hive suddenly starts escalating.
//
// This reads the in-memory health of THIS instance — it is a debugging view, not
// the dashboard. The cross-instance truth lives in api_key_health and is what
// /admin/ai-usage renders.
import { requireMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { providerHealth } from '@/lib/hive/providers'
import { keyHealth } from '@/lib/ai-keys/pool'

export async function GET() {
  const { error } = await requireMentor()
  if (error) return hiveError(error)

  return Response.json({ providers: providerHealth(), keys: keyHealth() })
}
