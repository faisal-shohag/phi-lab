// Vendor rate-limit health per API KEY, for the admin dashboard. Read-only.
//
// Source of truth is the `api_key_health` table, written best-effort by the key
// pool (src/lib/ai-keys/pool.ts). It's a durable mirror of that pool's in-memory
// Map, which the dashboard can't read because it lives in a different serverless
// instance. Merged here with two things only the environment knows: which keys
// exist at all, and the provider-level manual-park flags.
//
// The merge direction matters. The POOL is the list of keys — a key present in
// the environment but never yet called has no health row, and must still show up
// (as "never used"), because that is exactly the signal you look for after adding
// a key. And a key deleted from the environment leaves a stale health row behind,
// which is dropped here rather than shown as a key that no longer exists.
//
// Caveats worth stating on the page: only Groq returns a remaining-requests
// header, so Gemini/Ollama `remaining` is always null; and every number is
// last-observed — it moves only when a key is actually used or rate limited.
import { prisma } from '@/lib/prisma'
import { allKeys, type ProviderId } from '@/lib/ai-keys/pool'
import { getSettings } from '@/lib/admin/settings'

/** Only Groq sends x-ratelimit-* headers. The others tell us nothing until they 429. */
const REPORTS_REMAINING: Record<ProviderId, boolean> = {
  gemini: false,
  ollama: false,
  groq: true,
}

export interface KeyLimit {
  /** The key's env var name — never its value. */
  keyId: string
  provider: ProviderId
  /** Switched off by an admin: either this key, or its whole provider. */
  parked: boolean
  /** True when the whole provider is parked, not just this key. */
  providerParked: boolean
  /** True only for Groq; false means the vendor sends no remaining-count header. */
  reportsRemaining: boolean
  /** Last-observed requests left in the window; null when unknown/not reported. */
  remaining: number | null
  /** Milliseconds until an automatic rate-limit cooldown frees up; 0 = available. */
  cooldownMsLeft: number
  lastError: string | null
  /** When the health row was last written; null means this key has never been used. */
  updatedAt: string | null
}

export async function keyLimits(): Promise<KeyLimit[]> {
  const [rows, settings] = await Promise.all([prisma.apiKeyHealth.findMany(), getSettings()])
  const byKey = new Map(rows.map((r) => [r.keyId, r]))
  const now = Date.now()

  return allKeys().map((key) => {
    const row = byKey.get(key.keyId)
    const providerParked = settings[`flag.provider.${key.provider}.parked`]
    const reportsRemaining = REPORTS_REMAINING[key.provider]
    return {
      keyId: key.keyId,
      provider: key.provider,
      parked: providerParked || (row?.adminParked ?? false),
      providerParked,
      reportsRemaining,
      remaining: reportsRemaining ? (row?.remaining ?? null) : null,
      cooldownMsLeft: row?.cooldownUntil ? Math.max(0, row.cooldownUntil.getTime() - now) : 0,
      lastError: row?.lastError ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    }
  })
}
