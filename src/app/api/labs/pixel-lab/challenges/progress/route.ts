import { requireUser } from '@/lib/auth-server'
import { getPixelProgress } from '@/lib/pixel/progress'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const progress = await getPixelProgress(user.id)
  return Response.json(progress)
}
