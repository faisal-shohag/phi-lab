// Honeycomb: the permanent knowledge base of resolved, archived threads.
// With a query it runs full-text search; without one it lists recent entries.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { searchHoneycomb } from '@/lib/hive/search'

export async function GET(request: Request) {
  const { error } = await requireHiveUser()
  if (error) return hiveError(error)

  const q = new URL(request.url).searchParams.get('q') ?? ''
  const hits = await searchHoneycomb(q)

  return Response.json({
    entries: hits.map((h) => ({
      id: h.id,
      title: h.title,
      kbSummary: h.kbSummary,
      tags: h.tags,
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : String(h.createdAt),
    })),
  })
}
