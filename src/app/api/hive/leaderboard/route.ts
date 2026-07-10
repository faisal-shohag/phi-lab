// This week's top helpers. Read-only; the Queen Bee XP award is rolled once a
// week by the cleanup cron, not here.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { weeklyLeaderboard, isoWeekKey } from '@/lib/hive/leaderboard'

export async function GET() {
  const { error } = await requireHiveUser()
  if (error) return hiveError(error)

  const rows = await weeklyLeaderboard()
  return Response.json({ week: isoWeekKey(), rows })
}
