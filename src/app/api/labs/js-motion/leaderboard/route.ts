import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { weeklyVizLeaderboard, myWeeklyRank } from '@/lib/visualizer/leaderboard'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const [board, you] = await Promise.all([weeklyVizLeaderboard(10), myWeeklyRank(user.id)])
  return Response.json({ week: board.week, rows: board.rows, you, meId: user.id })
}
