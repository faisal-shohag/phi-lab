import { requireUser } from '@/lib/auth-server'
import { getProblemProgress } from '@/lib/visualizer/problems-progress'
import { getBugProgress } from '@/lib/visualizer/bugs-progress'

export const runtime = 'nodejs'

// Where the learner stands: which problems are done, per-topic counts, and
// whether Challenge mode has unlocked. Read-only; the gate itself is enforced in
// the activate route, not here.
//
// Bug Hunt rides along under `bugs` so the sidebar needs one round trip, not
// two. It is a separate object because bug fixes deliberately do NOT count
// toward the gate — the numbers must not get added up by accident.
export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const [progress, bugs] = await Promise.all([
    getProblemProgress(user.id),
    getBugProgress(user.id),
  ])
  return Response.json({ ...progress, bugs })
}
