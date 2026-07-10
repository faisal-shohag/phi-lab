// Pre-post coach: grades how answerable a draft question is and suggests
// concrete improvements (add the error text, add the code, sharpen the title).
// It never answers the question — that's the AI reply cycle's job.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { coachDraft } from '@/lib/hive/ai'
import { consumeDaily } from '@/lib/hive/rate-limit'
import { DAILY_COACH_LIMIT, MAX_TITLE_LEN, MAX_BODY_LEN } from '@/lib/hive/constants'

export const maxDuration = 30

export async function POST(request: Request) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  let title = ''
  let body = ''
  try {
    const json = await request.json()
    if (typeof json?.title === 'string') title = json.title.trim().slice(0, MAX_TITLE_LEN)
    if (typeof json?.body === 'string') body = json.body.trim().slice(0, MAX_BODY_LEN)
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (title.length < 5 || body.length < 10) {
    return hiveError('VALIDATION', 'Write a bit more before asking for feedback.')
  }

  if (!consumeDaily(`coach:${user.id}`, DAILY_COACH_LIMIT)) return hiveError('DAILY_LIMIT')

  try {
    const result = await coachDraft(title, body, { userId: user.id })
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return hiveError('SERVER_ERROR', `Could not review your draft: ${message}`)
  }
}
