import { withAdmin } from '@/lib/admin/guard'
import { hiveError } from '@/lib/hive/errors'
import { listProblems, createProblem, type ProblemInput } from '@/lib/code-lab/admin'

export async function GET() {
  return withAdmin(async () => Response.json(await listProblems()))
}

export async function POST(request: Request) {
  return withAdmin(async (actor) => {
    const body = (await request.json().catch(() => null)) as ProblemInput | null
    if (!body) return hiveError('VALIDATION', 'Invalid body.')
    const result = await createProblem(body, actor.id)
    if ('error' in result) return hiveError('VALIDATION', result.error)
    return Response.json(result)
  })
}
