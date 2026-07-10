// Read-only snapshot of the AI usage ledger + Hive outcomes.
// Raw SQL rather than the generated Prisma client, which Node can't import
// directly (TypeScript, extensionless internal imports).
//   node --env-file=.env scripts/ai-usage-report.mjs
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const q = async (label, sql) => {
  const { rows } = await client.query(sql)
  console.log(`\n— ${label} —`)
  if (rows.length === 0) console.log('  (none)')
  for (const r of rows) console.log('  ' + Object.entries(r).map(([k, v]) => `${k}=${v ?? '-'}`).join('  '))
}

await q(
  'usage by provider',
  `SELECT provider, success, count(*)::int AS calls, round(avg("latencyMs"))::int AS avg_ms,
          coalesce(sum("totalTokens"),0)::int AS tokens
   FROM ai_usage_event GROUP BY provider, success ORDER BY provider, success`,
)
await q('usage by task', `SELECT task, count(*)::int AS calls FROM ai_usage_event GROUP BY task ORDER BY calls DESC`)
await q(
  'rescues (won after an earlier provider failed)',
  `SELECT provider, count(*)::int AS rescues FROM ai_usage_event WHERE success AND "tryIndex" > 1 GROUP BY provider`,
)
await q(
  'errors by kind',
  `SELECT "errorKind", count(*)::int AS n FROM ai_usage_event WHERE NOT success GROUP BY "errorKind" ORDER BY n DESC`,
)
await q(
  'handovers',
  `SELECT CASE WHEN coalesce("escalatedAfterAiReplies",0) = 0 THEN 'direct' ELSE 'partial' END AS kind,
          count(*)::int AS posts
   FROM hive_post WHERE "escalatedAt" IS NOT NULL GROUP BY 1`,
)
await q(
  'resolutions',
  `SELECT coalesce("resolvedBy"::text,'unresolved') AS resolved_by, count(*)::int AS posts
   FROM hive_post WHERE type = 'QUESTION' GROUP BY 1 ORDER BY posts DESC`,
)
await q(
  'last 8 calls',
  `SELECT provider, task, success, "tryIndex" AS try, "latencyMs" AS ms, "totalTokens" AS tokens, "errorKind"
   FROM ai_usage_event ORDER BY "createdAt" DESC LIMIT 8`,
)

await client.end()
