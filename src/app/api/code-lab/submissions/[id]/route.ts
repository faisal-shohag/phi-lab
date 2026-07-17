import { requireUser } from '@/lib/auth-server'
import { hiveError } from '@/lib/hive/errors'
import { getSubmissionDetail } from '@/lib/code-lab/queries'

// One of the caller's own submissions, with the submitted code.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return hiveError('AUTH_REQUIRED')
  const { id } = await ctx.params
  const detail = await getSubmissionDetail(user.id, id)
  if (!detail) return hiveError('NOT_FOUND', 'Submission not found.')
  return Response.json(detail)
}
