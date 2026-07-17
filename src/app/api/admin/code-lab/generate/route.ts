import { withAdmin } from '@/lib/admin/guard'
import { hiveError } from '@/lib/hive/errors'
import { generateProblem } from '@/lib/code-lab/generate'
import type { ProblemDifficulty, ProblemType } from '@/lib/code-lab/types'

const DIFFS = new Set<ProblemDifficulty>(['EASY', 'MEDIUM', 'HARD', 'EXTRA_HARD'])
const TYPES = new Set<ProblemType>(['FUNCTION_RETURN', 'CONSOLE_OUTPUT'])

export async function POST(request: Request) {
  return withAdmin(async (actor) => {
    const body = (await request.json().catch(() => null)) as
      | { topic?: unknown; difficulty?: unknown; type?: unknown }
      | null
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
    const difficulty = body?.difficulty as ProblemDifficulty
    const type = body?.type as ProblemType
    if (!topic || !DIFFS.has(difficulty) || !TYPES.has(type)) {
      return hiveError('VALIDATION', 'Provide a topic, difficulty and problem type.')
    }
    try {
      const draft = await generateProblem({ topic, difficulty, type, userId: actor.id })
      return Response.json(draft)
    } catch (err) {
      return hiveError('SERVER_ERROR', err instanceof Error ? err.message : 'Generation failed.')
    }
  })
}
