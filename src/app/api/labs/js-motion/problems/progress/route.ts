import { requireUser } from '@/lib/auth-server'
import { getProblemProgress } from '@/lib/visualizer/problems-progress'

export const runtime = 'nodejs'

// Where the learner stands: which problems are done, per-topic counts, and
// whether Challenge mode has unlocked. Read-only; the gate itself is enforced in
// the activate route, not here.
export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const progress = await getProblemProgress(user.id)
  return Response.json(progress)
}
