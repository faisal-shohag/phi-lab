-- Idempotency for the client-reported live-session usage flush.
--
-- A live voice round is reported by the browser, twice over: a keepalive fetch
-- on normal end, and a sendBeacon on tab close. Exactly one row must survive.
-- The flush endpoint create()s and swallows the resulting P2002.
--
-- This is a PARTIAL unique index, which Prisma cannot express in schema.prisma,
-- so it lives here alongside hive_fts.sql. Being partial, it is invisible to
-- `prisma db push` and the schema stays drift-free.
--
-- Why not a plain @@unique in the schema:
--   @@unique([feature, sessionId])        -- collides: interview writes BOTH a
--                                            LIVE_SESSION and a REPORT row for
--                                            the same session.
--   @@unique([feature, task, sessionId])  -- blocks logging a failed REPORT
--                                            followed by its successful retry,
--                                            which is exactly the failure data
--                                            this table exists to show.
-- Scoping the constraint to task = 'LIVE_SESSION' avoids both.
--
-- Column names are camelCase: Prisma only @@maps the table, not the fields.
-- Idempotent: safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_live_once"
  ON "ai_usage_event" ("feature", "sessionId")
  WHERE "task" = 'LIVE_SESSION'::"AiTask" AND "sessionId" IS NOT NULL;
