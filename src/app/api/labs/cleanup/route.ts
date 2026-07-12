// Sweeps lab sessions that were abandoned without ever telling us — the beacon
// that died with the browser. Invoked by Vercel Cron (see vercel.json), guarded
// by the same shared secret as the Hive cleanup: Vercel sends
// `Authorization: Bearer $CRON_SECRET` automatically once the env var is set.
import { sweepStaleLabSessions } from '@/lib/labs/sweep'

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
  return Response.json(await sweepStaleLabSessions())
}

// Vercel Cron issues GET requests; accept both.
export const GET = POST
