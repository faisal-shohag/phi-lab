// Multi-provider, multi-key structured generation. Server-only. Used by Hive, the
// JS Motion tutor, and the post-session report graders.
//
// Why not just the Gemini SDK? Because a single provider is a single point of
// failure: one 429 and every student's post stalls. This engine rotates across
// three providers AND across every API key each provider has, fails over on
// error, and parks whichever KEY hit its rate limit until the limit resets.
//
// Two axes of rotation, and they mean different things:
//   • provider — priority order Gemini → Ollama → Groq, rotated per request so
//     consecutive posts don't all land on the same vendor.
//   • key — every key the environment offers for that provider (see
//     src/lib/ai-keys/pool.ts). Keys are discovered by naming convention, so a
//     new GEMINI_API_KEY_5 joins the rotation with no change to this file.
//
// The attempt chain tries a different PROVIDER before it tries a second key of
// the same provider: if Gemini as a whole is having a bad minute, walking its
// four keys in a row just burns the attempt budget four times over.
//
// What each provider actually supports (probed against the live APIs, not
// assumed):
//   • Gemini  — native responseSchema. No rate-limit headers; 429 carries a
//               retryDelay in the error body.
//   • Groq    — strict `json_schema` response_format, but ONLY on some models
//               (llama-3.3-70b rejects it; openai/gpt-oss-20b accepts it).
//               Returns full x-ratelimit-* headers.
//   • Ollama  — ignores BOTH `format` and `response_format`. It will still
//               emit JSON when the prompt demands it, usually inside a ```json
//               fence, so we ask for JSON and extract it. No rate-limit headers.
import { extractJson, toJsonSchema, requireAllProperties } from './schema'
import { recordAiUsage, type AiCallContext, type TokenUsage } from './usage'
import {
  adminParkedKeys,
  availableKeys,
  AuthFailed,
  clearError,
  errorKindOf,
  keysFor,
  noteError,
  park,
  ProviderError,
  providerConfigured,
  PROVIDER_ENUM,
  RateLimited,
  recordRateLimit,
  throwForStatus,
  type ApiKey,
  type ProviderId,
} from '@/lib/ai-keys/pool'
import { getSettings } from '@/lib/admin/settings'
import type { AiFeature } from '@/generated/prisma/client'

export { PROVIDER_ENUM, providerConfigured, type ProviderId }

/**
 * Everything a usage row needs. `feature` is optional and defaults to HIVE —
 * this engine grew up serving Hive, but the JS Motion tutor and the lab report
 * graders now borrow its failover machinery, so a caller can override the feature
 * it's stamped under to keep the admin dashboard's per-feature breakdown honest.
 */
export type HiveCallContext = Omit<AiCallContext, 'feature'> & { feature?: AiFeature }

/** A rejected key is out for five minutes; it won't start working in three seconds. */
const AUTH_COOLDOWN_MS = 5 * 60_000
/** Total attempts — provider+key pairs — for one generation before we give up (→ mentor). */
export const MAX_PROVIDER_ATTEMPTS = 4

const TIMEOUT_MS = 45_000

/** What one provider call produced. */
interface ProviderReply {
  text: string
  tokens: TokenUsage
}

interface Provider {
  id: ProviderId
  /** Lower runs first when we fail over. */
  priority: number
  model: string
  /** The key is chosen by the pool and handed in — a provider owns no key of its own. */
  generate(prompt: string, geminiSchema: object, key: ApiKey, signal: AbortSignal): Promise<ProviderReply>
}

// ── Providers ─────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3.1-flash-lite'
const OLLAMA_MODEL = 'gemma3:27b'
// llama-3.3-70b-versatile rejects json_schema; gpt-oss-20b accepts it.
const GROQ_MODEL = 'openai/gpt-oss-20b'

const gemini: Provider = {
  id: 'gemini',
  priority: 0,
  model: GEMINI_MODEL,
  async generate(prompt, geminiSchema, key, signal) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key.value },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: geminiSchema,
          },
        }),
      },
    )
    recordRateLimit(key, res)
    if (!res.ok) await throwForStatus(key, res)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new ProviderError('gemini returned an empty response', 'SERVER_ERROR')
    const u = data?.usageMetadata
    return {
      text,
      tokens: {
        promptTokens: u?.promptTokenCount,
        responseTokens: u?.candidatesTokenCount,
        totalTokens: u?.totalTokenCount,
      },
    }
  },
}

const groq: Provider = {
  id: 'groq',
  priority: 2,
  model: GROQ_MODEL,
  async generate(prompt, geminiSchema, key, signal) {
    // Groq's strict mode requires every property to be listed in `required`
    // and forbids extra keys, so optional fields are made required-but-empty.
    const schema = requireAllProperties(toJsonSchema(geminiSchema))
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key.value}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'hive_response', strict: true, schema },
        },
      }),
    })
    recordRateLimit(key, res)
    if (!res.ok) await throwForStatus(key, res)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new ProviderError('groq returned an empty response', 'SERVER_ERROR')
    const u = data?.usage
    return {
      text,
      tokens: {
        promptTokens: u?.prompt_tokens,
        responseTokens: u?.completion_tokens,
        totalTokens: u?.total_tokens,
      },
    }
  },
}

const ollama: Provider = {
  id: 'ollama',
  priority: 1,
  model: OLLAMA_MODEL,
  async generate(prompt, geminiSchema, key, signal) {
    // Ollama Cloud silently ignores `format` and `response_format`, so the
    // schema goes in the prompt and we dig the JSON out of the reply.
    const schema = toJsonSchema(geminiSchema)
    const instructed = [
      prompt,
      '',
      'Reply with a single JSON object and nothing else — no prose, no markdown fence.',
      'It must match this JSON Schema exactly:',
      JSON.stringify(schema),
    ].join('\n')

    const res = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key.value}` },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        // The default output cap truncates a markdown answer mid-string, which
        // then surfaces as an opaque JSON.parse failure. Give it room to close
        // the object, and treat a hit cap as an explicit error so we fail over
        // instead of guessing at half a reply.
        options: { num_predict: 4096, temperature: 0.6 },
        messages: [{ role: 'user', content: instructed }],
      }),
    })
    recordRateLimit(key, res)
    if (!res.ok) await throwForStatus(key, res)
    const data = await res.json()
    if (data?.done_reason === 'length') {
      throw new ProviderError('ollama truncated its reply at the token cap', 'TRUNCATED')
    }
    const text = data?.message?.content
    if (!text) throw new ProviderError('ollama returned an empty response', 'SERVER_ERROR')
    return {
      text: extractJson(text),
      tokens: {
        promptTokens: data?.prompt_eval_count,
        responseTokens: data?.eval_count,
        totalTokens:
          data?.prompt_eval_count != null && data?.eval_count != null
            ? data.prompt_eval_count + data.eval_count
            : undefined,
      },
    }
  },
}

const PROVIDERS: Provider[] = [gemini, ollama, groq].sort((a, b) => a.priority - b.priority)

// ── Selection + failover ──────────────────────────────────────────────────

/** One attempt: this provider, on this key. */
interface Candidate {
  provider: Provider
  key: ApiKey
}

// Rotates the starting provider so successive posts spread across the fleet
// instead of hammering whichever one is first. (Key-level rotation lives in the
// pool, which keeps its own cursor per provider.)
let rotation = 0

/** The set of providers an admin has switched off, wholesale. */
async function adminParkedProviders(): Promise<ReadonlySet<ProviderId>> {
  const parked = new Set<ProviderId>()
  try {
    const settings = await getSettings()
    if (settings['flag.provider.gemini.parked']) parked.add('gemini')
    if (settings['flag.provider.ollama.parked']) parked.add('ollama')
    if (settings['flag.provider.groq.parked']) parked.add('groq')
  } catch {
    // A settings outage must not take the whole fleet offline. Park nothing.
  }
  return parked
}

/**
 * The attempt chain: every usable (provider, key) pair, best first.
 *
 * Providers rotate so the same vendor doesn't always go first, and each
 * contributes ONE key per pass. Breadth before depth — a second Gemini key is
 * only worth trying after Ollama and Groq have had their turn, because the
 * failure that knocked out the first Gemini key is more often Gemini's than the
 * key's.
 *
 * Two kinds of parking remove a candidate here, and neither should resurrect it:
 * an admin kill switch (the bill or the output is wrong) and an automatic
 * cooldown (the vendor said 429).
 */
async function attemptChain(): Promise<Candidate[]> {
  const [parkedProviders, parkedKeys] = await Promise.all([adminParkedProviders(), adminParkedKeys()])

  // Peek — `advance: false`. Every provider is asked for its keys on every
  // request, but only the one that leads actually serves it, so advancing them
  // all here would tick the key cursors in lockstep with the provider rotation
  // and alias (see availableKeys). The leading provider's cursor is advanced
  // below, once we know who it is.
  const usable = PROVIDERS.filter((p) => !parkedProviders.has(p.id)).map((provider) => ({
    provider,
    keys: availableKeys(provider.id, 'text', parkedKeys, false),
  }))
  const live = usable.filter((u) => u.keys.length > 0)
  if (live.length === 0) return []

  const start = rotation++ % live.length
  const order = [...live.slice(start), ...live.slice(0, start)]

  // The provider that goes first is the one whose key is actually spent, so it —
  // and only it — moves on to its next key for the next request.
  order[0] = {
    provider: order[0].provider,
    keys: availableKeys(order[0].provider.id, 'text', parkedKeys, true),
  }

  const chain: Candidate[] = []
  const deepest = Math.max(...order.map((u) => u.keys.length))
  for (let pass = 0; pass < deepest; pass++) {
    for (const { provider, keys } of order) {
      const key = keys[pass]
      if (key) chain.push({ provider, key })
    }
  }
  return chain
}

/** Snapshot for logging/debugging: one row per key, grouped under its provider. */
export function providerHealth() {
  const configured = providerConfigured()
  return PROVIDERS.map((p) => ({
    id: p.id,
    configured: configured[p.id],
    model: p.model,
    keys: keysFor(p.id).map((k) => k.keyId),
  }))
}

export class AllProvidersFailed extends Error {
  constructor(public attempts: { id: ProviderId; keyId: string; error: string }[]) {
    super(
      attempts.length === 0
        ? 'no AI provider available: every key is unconfigured, parked or cooling down'
        : `all AI providers failed: ${attempts.map((a) => `${a.id}/${a.keyId} (${a.error})`).join('; ')}`,
    )
    this.name = 'AllProvidersFailed'
  }
}

/**
 * Generate a structured response, failing over between providers and keys.
 *
 * Tries up to MAX_PROVIDER_ATTEMPTS candidates. A rate-limited key is parked
 * until its limit resets and is skipped by later calls. When every attempt fails
 * the caller (runAiAttempt) escalates the post to a mentor.
 */
export interface GenerationResult<T> {
  data: T
  /** Which provider actually answered — recorded on the post's timeline. */
  provider: ProviderId
  /** Which key answered, by env var name. For the dashboard, not for users. */
  keyId: string
}

/**
 * Like generateStructured, but also tells you who answered.
 *
 * Every attempt — success or failure — writes one AiUsageEvent stamped with the
 * key it used, so the admin dashboard sees the failovers and the per-key burn,
 * not just the answer that eventually landed. `ctx` says what the call was for.
 */
export async function generateStructuredWithMeta<T>(
  prompt: string,
  geminiSchema: object,
  ctx: HiveCallContext,
): Promise<GenerationResult<T>> {
  const attempts: { id: ProviderId; keyId: string; error: string }[] = []
  const chain = (await attemptChain()).slice(0, MAX_PROVIDER_ATTEMPTS)

  if (chain.length === 0) {
    void recordAiUsage({
      feature: 'HIVE',
      ...ctx,
      provider: 'GEMINI', // no key was reachable; the row records the gap
      model: 'none',
      success: false,
      latencyMs: 0,
      tryIndex: 0,
      errorKind: 'NO_PROVIDER',
      errorMessage: 'every key is unconfigured, parked or cooling down',
    })
    throw new AllProvidersFailed(attempts)
  }

  for (const [index, { provider, key }] of chain.entries()) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const startedAt = Date.now()
    try {
      const reply = await provider.generate(prompt, geminiSchema, key, controller.signal)
      const parsed = JSON.parse(reply.text) as T
      clearError(key)
      void recordAiUsage({
        feature: 'HIVE',
        ...ctx,
        provider: PROVIDER_ENUM[provider.id],
        keyId: key.keyId,
        model: provider.model,
        success: true,
        latencyMs: Date.now() - startedAt,
        tryIndex: index + 1,
        tokens: reply.tokens,
        confidence: typeof (parsed as { confidence?: unknown })?.confidence === 'number'
          ? (parsed as { confidence: number }).confidence
          : undefined,
      })
      return { data: parsed, provider: provider.id, keyId: key.keyId }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      const kind = errorKindOf(err)

      // Only a rate limit or a rejected key takes a KEY out of rotation, and it
      // takes only that key — its siblings and the provider itself stay in. A
      // one-off 500, timeout or malformed body parks nothing: that would let a
      // single bad post cascade into a fleet-wide outage.
      if (err instanceof RateLimited) {
        park(key, err.retryAfterMs, 'rate limited')
        attempts.push({
          id: provider.id,
          keyId: key.keyId,
          error: `rate limited for ${Math.round(err.retryAfterMs / 1000)}s`,
        })
      } else if (err instanceof AuthFailed) {
        park(key, AUTH_COOLDOWN_MS, message)
        attempts.push({ id: provider.id, keyId: key.keyId, error: message })
      } else {
        noteError(key, message)
        attempts.push({ id: provider.id, keyId: key.keyId, error: message })
      }

      void recordAiUsage({
        feature: 'HIVE',
        ...ctx,
        provider: PROVIDER_ENUM[provider.id],
        keyId: key.keyId,
        model: provider.model,
        success: false,
        latencyMs: Date.now() - startedAt,
        tryIndex: index + 1,
        errorKind: kind,
        errorMessage: message,
      })

      // Switch candidate immediately. Logged because a key that quietly always
      // loses the race is invisible otherwise — its lastError gets cleared by its
      // next success on a different call.
      console.warn(`[hive] ${provider.id}/${key.keyId} failed (${kind}), failing over:`, message)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new AllProvidersFailed(attempts)
}

/** The common case: callers that don't care which provider answered. */
export async function generateStructured<T>(
  prompt: string,
  geminiSchema: object,
  ctx: HiveCallContext,
): Promise<T> {
  return (await generateStructuredWithMeta<T>(prompt, geminiSchema, ctx)).data
}
