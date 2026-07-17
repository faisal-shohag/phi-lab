import { withAdmin } from '@/lib/admin/guard'
import { hiveError } from '@/lib/hive/errors'
import { getContest, updateContest, deleteContest, type ContestInput } from '@/lib/code-lab/contest-admin'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    const contest = await getContest(id)
    if (!contest) return hiveError('NOT_FOUND', 'Contest not found.')
    return Response.json(contest)
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as ContestInput | null
    if (!body) return hiveError('VALIDATION', 'Invalid body.')
    const result = await updateContest(id, body)
    if ('error' in result) return hiveError(result.error === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION', result.error)
    return Response.json(result)
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await params
    await deleteContest(id)
    return Response.json({ ok: true })
  })
}
