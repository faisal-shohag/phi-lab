import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { hiveError } from '@/lib/hive/errors'
import { listUserSubmissions } from '@/lib/code-lab/queries'

// This user's submissions for one problem. Own submissions only.
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return hiveError('AUTH_REQUIRED')
  const problemId = new URL(request.url).searchParams.get('problemId')
  if (!problemId) return hiveError('VALIDATION', 'problemId is required.')
  return Response.json(await listUserSubmissions(user.id, problemId))
}
