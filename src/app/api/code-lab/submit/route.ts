import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { isSuspended } from '@/lib/admin/suspension'
import { hiveError } from '@/lib/hive/errors'
import { submitSolution } from '@/lib/code-lab/submit'
import type { CodeLanguage } from '@/lib/code-lab/types'

const LANGS = new Set<CodeLanguage>(['JAVASCRIPT', 'TYPESCRIPT'])

// Grade a submission in the server sandbox and store the result. XP is awarded
// here, never from the client. Hidden test data never appears in the response.
export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return hiveError('AUTH_REQUIRED')
  // The session cookie is a 30-day JWT, so a suspension only bites at a DB read.
  if (await isSuspended(user.id)) return hiveError('FORBIDDEN', 'Your account is suspended.')

  const body = (await request.json().catch(() => null)) as
    | { problemId?: unknown; language?: unknown; code?: unknown; contestId?: unknown }
    | null
  const problemId = typeof body?.problemId === 'string' ? body.problemId : ''
  const language = body?.language as CodeLanguage
  const code = typeof body?.code === 'string' ? body.code : ''
  const contestId = typeof body?.contestId === 'string' ? body.contestId : undefined

  if (!problemId || !LANGS.has(language)) return hiveError('VALIDATION', 'Invalid submission.')

  const result = await submitSolution(user.id, problemId, language, code, contestId)
  if (!('verdict' in result)) return hiveError(result.error, result.message)
  return Response.json(result)
}
