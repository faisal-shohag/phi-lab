// Honeycomb: the permanent knowledge base of resolved, archived threads.
// With a query it runs full-text search; without one it lists recent entries.
import { unstable_cache as nextCache } from 'next/cache'
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { searchHoneycomb } from '@/lib/hive/search'
import { HONEYCOMB_TAG } from '@/lib/hive/cache'

export async function GET(request: Request) {
  const { error } = await requireHiveUser()
  if (error) return hiveError(error)

  const q = new URL(request.url).searchParams.get('q') ?? ''
  // Archived entries only change via archiveToHoneycomb, which invalidates
  // this tag — the TTL here is just a safety net.
  const hits = await nextCache(() => searchHoneycomb(q), ['hive-honeycomb', q], {
    tags: [HONEYCOMB_TAG],
    revalidate: 300,
  })()

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
