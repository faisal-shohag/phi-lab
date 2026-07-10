-- Full-text search for the Hive.
--
-- A GIN *expression* index over to_tsvector(title + body + kbSummary). We index
-- an expression rather than a generated column on purpose: Prisma cannot model
-- a generated column, and `prisma db push` would keep trying to alter it away.
-- An expression index is invisible to Prisma, so the schema stays drift-free.
--
-- Queries in src/lib/hive/search.ts must repeat this expression *character for
-- character* for Postgres to use the index.
--
-- Powers duplicate detection in the composer and Honeycomb search.
-- Idempotent: safe to re-run.

DROP INDEX IF EXISTS "hive_post_search_idx";
ALTER TABLE "hive_post" DROP COLUMN IF EXISTS "search";

CREATE INDEX IF NOT EXISTS "hive_post_search_idx" ON "hive_post" USING GIN (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce("kbSummary", '')
  )
);
