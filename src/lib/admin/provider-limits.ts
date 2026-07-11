// Vendor rate-limit health per AI provider, for the admin dashboard. Read-only.
//
// Source of truth is the `provider_health` table, written best-effort by the Hive
// failover engine (src/lib/hive/providers.ts). It's a durable mirror of that
// engine's in-memory Map, which the dashboard can't read because it lives in a
// different serverless instance. Merged here with two things only the code knows:
// whether a key is configured, and the admin manual-park flags.
//
// Caveats worth stating on the page: only Groq returns a remaining-requests
// header, so Gemini/Ollama `remaining` is always null; and every number is
// last-observed — it moves only when a provider is actually called or rate limited.
import { prisma } from '@/lib/prisma'
import { providerConfigured } from '@/lib/hive/providers'
import { getSettings } from '@/lib/admin/settings'
import type { AiProvider } from '@/generated/prisma/client'

type ProviderId = 'gemini' | 'ollama' | 'groq'

/** Display order matches the failover priority: Gemini, Ollama, Groq. */
const PROVIDERS: { id: ProviderId; enum: AiProvider; reportsRemaining: boolean }[] = [
  { id: 'gemini', enum: 'GEMINI', reportsRemaining: false },
  { id: 'ollama', enum: 'OLLAMA', reportsRemaining: false },
  { id: 'groq', enum: 'GROQ', reportsRemaining: true },
]

export interface ProviderLimit {
  provider: ProviderId
  /** API key present in the environment. */
  configured: boolean
  /** Admin manual kill switch (flag.provider.*.parked), distinct from cooldown. */
  parked: boolean
  /** True only for Groq; false means the vendor sends no remaining-count header. */
  reportsRemaining: boolean
  /** Last-observed requests left in the window; null when unknown/not reported. */
  remaining: number | null
  /** Milliseconds until an automatic rate-limit cooldown frees up; 0 = available. */
  cooldownMsLeft: number
  lastError: string | null
  /** When the snapshot row was last written; null if it never has been. */
  updatedAt: string | null
}

export async function providerLimits(): Promise<ProviderLimit[]> {
  const [rows, settings] = await Promise.all([
    prisma.providerHealth.findMany(),
    getSettings(),
  ])
  const configured = providerConfigured()
  const byProvider = new Map(rows.map((r) => [r.provider, r]))
  const now = Date.now()

  return PROVIDERS.map(({ id, enum: enumId, reportsRemaining }) => {
    const row = byProvider.get(enumId)
    const cooldownMsLeft = row?.cooldownUntil
      ? Math.max(0, row.cooldownUntil.getTime() - now)
      : 0
    return {
      provider: id,
      configured: configured[id],
      parked: settings[`flag.provider.${id}.parked`],
      reportsRemaining,
      remaining: reportsRemaining ? (row?.remaining ?? null) : null,
      cooldownMsLeft,
      lastError: row?.lastError ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    }
  })
}
