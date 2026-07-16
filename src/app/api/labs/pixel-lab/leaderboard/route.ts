import { requireUser } from '@/lib/auth-server'
import { weeklyPixelLeaderboard, myWeeklyPixelRank } from '@/lib/pixel/leaderboard'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const [board, you] = await Promise.all([weeklyPixelLeaderboard(), myWeeklyPixelRank(user.id)])
  return Response.json({ week: board.week, rows: board.rows, you, meId: user.id })
}
