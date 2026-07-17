import { withAdmin } from '@/lib/admin/guard'
import { hiveError } from '@/lib/hive/errors'
import { getProblem, updateProblem, deleteProblem, type ProblemInput } from '@/lib/code-lab/admin'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await ctx.params
    const problem = await getProblem(id)
    if (!problem) return hiveError('NOT_FOUND', 'Problem not found.')
    return Response.json(problem)
  })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => null)) as (Partial<ProblemInput> & { published?: boolean }) | null
    if (!body) return hiveError('VALIDATION', 'Invalid body.')
    const result = await updateProblem(id, body)
    if ('error' in result) {
      return result.error === 'NOT_FOUND' ? hiveError('NOT_FOUND') : hiveError('VALIDATION', result.error)
    }
    return Response.json(result)
  })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdmin(async () => {
    const { id } = await ctx.params
    await deleteProblem(id)
    return Response.json({ ok: true })
  })
}
