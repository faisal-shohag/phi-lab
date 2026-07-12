import { requireUser } from '@/lib/auth-server'
import { getWeeklyReport } from '@/lib/path/weekly'

// Generate (or return the cached) weekly report card. GET is the normal read;
// the page calls it lazily so the map paints before the AI round-trip finishes.
// POST with { force: true } regenerates — used by the "refresh my week" button
// and the weekly cron. The AI cost is one call, then cached for the ISO week.
export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const report = await getWeeklyReport(user.id)
  return Response.json({ report })
}

export async function POST() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const report = await getWeeklyReport(user.id, { force: true })
  return Response.json({ report })
}
