import { withAdmin } from '@/lib/admin/guard'
import { hiveError } from '@/lib/hive/errors'
import { listContests, createContest, type ContestInput } from '@/lib/code-lab/contest-admin'

export async function GET() {
  return withAdmin(async () => Response.json(await listContests()))
}

export async function POST(request: Request) {
  return withAdmin(async (actor) => {
    const body = (await request.json().catch(() => null)) as ContestInput | null
    if (!body) return hiveError('VALIDATION', 'Invalid body.')
    const result = await createContest(body, actor.id)
    if ('error' in result) return hiveError('VALIDATION', result.error)
    return Response.json(result)
  })
}
