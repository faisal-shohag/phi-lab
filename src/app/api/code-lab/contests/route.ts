import { requireUser } from '@/lib/auth-server'
import { hiveError } from '@/lib/hive/errors'
import { listVisibleContests } from '@/lib/code-lab/contests'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireUser()
  if (!user) return hiveError('AUTH_REQUIRED')
  return Response.json({ contests: await listVisibleContests() })
}
