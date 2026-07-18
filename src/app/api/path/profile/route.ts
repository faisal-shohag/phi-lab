import { requireUser } from '@/lib/auth-server'
import { saveOnboarding, updateProfile } from '@/lib/path/profile'
import type { PathGoal } from '@/lib/path/goals'

const GOALS: PathGoal[] = ['FRONTEND', 'FULLSTACK', 'INTERVIEW_PREP']

function isGoal(v: unknown): v is PathGoal {
  return typeof v === 'string' && (GOALS as string[]).includes(v)
}

// Onboarding save (mode: 'onboard') and later goal/pace edits (mode: 'update').
// Onboarding stamps onboardedAt so the /path gate stops redirecting here.
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  let body: { mode?: string; goal?: unknown; weeklyHours?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const hours = typeof body.weeklyHours === 'number' ? body.weeklyHours : undefined

  if (body.mode === 'update') {
    if (body.goal !== undefined && !isGoal(body.goal)) {
      return Response.json({ error: 'BAD_GOAL' }, { status: 400 })
    }
    await updateProfile(user.id, { goal: isGoal(body.goal) ? body.goal : undefined, weeklyHours: hours })
    return Response.json({ ok: true })
  }

  // Default: onboarding. Goal + hours are both required to start.
  if (!isGoal(body.goal)) return Response.json({ error: 'BAD_GOAL' }, { status: 400 })
  if (hours === undefined) return Response.json({ error: 'BAD_HOURS' }, { status: 400 })
  await saveOnboarding(user.id, body.goal, hours)
  return Response.json({ ok: true })
}
