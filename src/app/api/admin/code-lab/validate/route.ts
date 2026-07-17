import { withAdmin } from '@/lib/admin/guard'
import { hiveError } from '@/lib/hive/errors'
import { validateSolution } from '@/lib/code-lab/admin'
import type { ProblemTests, ProblemType } from '@/lib/code-lab/types'

// Run the reference solution against the current cases. Used before publishing:
// the solution must pass, and we offer the recomputed expected values so the
// author never has to trust hand-typed outputs.
export async function POST(request: Request) {
  return withAdmin(async () => {
    const body = (await request.json().catch(() => null)) as
      | { type?: ProblemType; fnName?: string | null; solutionJs?: string; tests?: ProblemTests }
      | null
    if (!body?.type || typeof body.solutionJs !== 'string' || !body.tests) {
      return hiveError('VALIDATION', 'Provide type, solutionJs and tests.')
    }
    const result = await validateSolution(body.type, body.fnName ?? null, body.solutionJs, body.tests)
    return Response.json(result)
  })
}
