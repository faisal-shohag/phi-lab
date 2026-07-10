// Duplicate detection for the composer: before a student posts, show the
// already-solved questions that look like theirs. The cheapest fix for a
// question is the one that was already answered last week.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { findSimilar } from '@/lib/hive/search'
import { MAX_TITLE_LEN, MAX_BODY_LEN } from '@/lib/hive/constants'

export async function POST(request: Request) {
  const { error } = await requireHiveUser()
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
  if (title.length < 5) return Response.json({ similar: [] })

  const hits = await findSimilar(title, body)
  return Response.json({
    similar: hits.map((h) => ({ id: h.id, title: h.title, tags: h.tags, status: h.status })),
  })
}
