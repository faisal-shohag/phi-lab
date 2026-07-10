// Postgres full-text search over Hive posts. No vector DB, no embedding calls:
// `websearch_to_tsquery` + `ts_rank` against the GIN expression index created in
// prisma/sql/hive_fts.sql.
//
// The to_tsvector(...) expression below must stay character-for-character
// identical to the one in that index, or Postgres will fall back to a seq scan.
import { prisma } from '@/lib/prisma'

export interface SearchHit {
  id: string
  title: string
  kbSummary: string | null
  tags: string[]
  status: string
  createdAt: Date
  rank: number
}

/**
 * `websearch_to_tsquery` parses free text safely (phrases, OR, -negation) and the
 * value is bound as a query parameter, so we only collapse whitespace and cap
 * the length.
 */
function normalize(q: string): string {
  return q.replace(/\s+/g, ' ').trim().slice(0, 300)
}

/**
 * Build an OR-of-terms tsquery ("foreach | async | await") from free text.
 *
 * Similarity is not the same problem as search. `websearch_to_tsquery` ANDs
 * every word, so feeding it a whole draft matches nothing — a near-duplicate
 * shares *most* words, never all of them. We OR the distinctive terms instead
 * and let ts_rank decide which hits are actually close.
 *
 * Tokens are stripped to [a-z0-9_] so nothing can inject tsquery operators.
 */
function orTsQuery(text: string, maxTerms = 12): string | null {
  const terms = Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((t) => t.length >= 3),
    ),
  ).slice(0, maxTerms)
  return terms.length ? terms.join(' | ') : null
}

/** Below this ts_rank the "duplicate" is just noise sharing a stopword or two. */
const SIMILAR_MIN_RANK = 0.05

/**
 * Questions already answered that look like this draft. Used by the composer to
 * surface "someone already solved this" before a duplicate is posted.
 *
 * The title carries most of the signal, so only a little of the body is mixed in.
 */
export async function findSimilar(title: string, body: string, limit = 5): Promise<SearchHit[]> {
  const query = orTsQuery(`${title} ${normalize(body).slice(0, 200)}`)
  if (!query) return []

  return prisma.$queryRaw<SearchHit[]>`
    SELECT id, title, "kbSummary", tags, status::text AS status, "createdAt",
           ts_rank(
             to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce("kbSummary", '')),
             to_tsquery('english', ${query})
           ) AS rank
    FROM hive_post
    WHERE status IN ('RESOLVED', 'ARCHIVED')
      AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce("kbSummary", ''))
          @@ to_tsquery('english', ${query})
      AND ts_rank(
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce("kbSummary", '')),
            to_tsquery('english', ${query})
          ) > ${SIMILAR_MIN_RANK}
    ORDER BY rank DESC
    LIMIT ${limit}
  `
}

/** The Honeycomb knowledge base: archived, accepted answers only. */
export async function searchHoneycomb(q: string, limit = 20): Promise<SearchHit[]> {
  const query = normalize(q)

  if (!query) {
    const recent = await prisma.hivePost.findMany({
      where: { status: 'ARCHIVED' },
      orderBy: { archivedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, kbSummary: true, tags: true, status: true, createdAt: true },
    })
    return recent.map((r) => ({ ...r, status: r.status as string, rank: 0 }))
  }

  return prisma.$queryRaw<SearchHit[]>`
    SELECT id, title, "kbSummary", tags, status::text AS status, "createdAt",
           ts_rank(
             to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce("kbSummary", '')),
             websearch_to_tsquery('english', ${query})
           ) AS rank
    FROM hive_post
    WHERE status = 'ARCHIVED'
      AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce("kbSummary", ''))
          @@ websearch_to_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `
}
