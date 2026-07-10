// Daily maintenance, invoked by Vercel Cron (see vercel.json). Guarded by a
// shared secret so it can't be triggered by anyone who finds the URL — Vercel
// sends `Authorization: Bearer $CRON_SECRET` automatically once the env var is
// set.
import { runCleanupCron } from '@/lib/hive/cleanup'

export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const report = await runCleanupCron()
  return Response.json(report)
}

// Vercel Cron issues GET requests; accept both.
export const GET = POST
