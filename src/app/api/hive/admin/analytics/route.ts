// Admin-only AI analytics. Feeds the dashboard: which provider did the work,
// how often it failed and why, how many questions the AI resolved alone, and
// how many it handed to a human (with or without trying first).
//
//   GET /api/hive/admin/analytics?days=30
import { requireAdmin } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { hiveAnalytics } from '@/lib/hive/analytics'

export async function GET(request: Request) {
  const { error } = await requireAdmin()
  if (error) return hiveError(error)

  const raw = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(raw) ? Math.min(365, Math.max(1, Math.floor(raw))) : 30

  return Response.json(await hiveAnalytics(days))
}
