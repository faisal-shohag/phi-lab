// A learner's own attempts at one challenge.
//
// Scoped to the caller. There is deliberately no way to ask for anyone else's:
// this table holds the code people wrote while they were still bad at it, which
// is the whole point of keeping it and a good reason not to hand it around.

import { requireUser } from '@/lib/auth-server'
import { listSubmissions } from '@/lib/pixel/submissions'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const challengeId = new URL(request.url).searchParams.get('challengeId')
  if (!challengeId) return Response.json({ error: 'CHALLENGE_REQUIRED' }, { status: 400 })

  // userId comes from the session, never the query string.
  const submissions = await listSubmissions(user.id, challengeId)
  return Response.json({ submissions })
}
