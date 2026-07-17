import { requireUser } from '@/lib/auth-server'
import { hiveError } from '@/lib/hive/errors'
import { globalCodeLabBoard, myGlobalRank } from '@/lib/code-lab/contests'

export const runtime = 'nodejs'

// All-time global Code Lab board, ranked by distinct problems solved. Shaped for
// the shared LeaderboardSheet ({ rows, you, meId }); `week` is null (not weekly).
export async function GET() {
  const user = await requireUser()
  if (!user) return hiveError('AUTH_REQUIRED')
  const [board, you] = await Promise.all([globalCodeLabBoard(), myGlobalRank(user.id)])
  return Response.json({ week: null, rows: board.rows, you, meId: user.id })
}
