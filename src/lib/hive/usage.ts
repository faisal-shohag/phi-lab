// Moved to src/lib/ai-usage/record.ts once the labs were instrumented too and
// the ledger stopped being Hive-only. Re-exported here so the Hive call sites
// keep their import path.
export { recordAiUsage, type AiCallContext, type TokenUsage, type UsageRow } from '@/lib/ai-usage/record'
