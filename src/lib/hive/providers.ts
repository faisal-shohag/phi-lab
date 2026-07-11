// Multi-provider structured generation for Hive, with failover and rate-limit
// cooldowns. Server-only.
//
// Why not just the Gemini SDK? Because a single provider is a single point of
// failure: one 429 and every student's post stalls. Hive rotates across three
// providers, fails over on error, and parks a provider that has hit its rate
// limit until the limit resets.
//
// Provider order (priority): Gemini → Ollama → Groq. Requests rotate the
// starting provider so consecutive posts don't all land on the same one; on
// failure the request walks the remaining providers in priority order.
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
import { getSettings } from '@/lib/admin/settings'
import type { AiErrorKind, AiFeature, AiProvider } from '@/generated/prisma/client'

export type ProviderId = 'gemini' | 'ollama' | 'groq'

/**
 * Everything a usage row needs. `feature` is optional and defaults to HIVE —
 * this engine grew up serving Hive, but the JS Motion tutor now borrows its
 * failover machinery, so a caller can override the feature it's stamped under
 * to keep the admin dashboard's per-feature breakdown honest.
 */
export type HiveCallContext = Omit<AiCallContext, 'feature'> & { feature?: AiFeature }

/** ProviderId (internal, lowercase) → the Prisma enum stored on rows. */
export const PROVIDER_ENUM: Record<ProviderId, AiProvider> = {
  gemini: 'GEMINI',
  ollama: 'OLLAMA',
  groq: 'GROQ',
}

/** How long a provider stays parked when a rate limit gives us no reset hint. */
const DEFAULT_COOLDOWN_MS = 60_000
/** A rejected key won't start working in the next few seconds. */
const AUTH_COOLDOWN_MS = 5 * 60_000
/** Total provider attempts for one generation before we give up (→ mentor). */
export const MAX_PROVIDER_ATTEMPTS = 3

const TIMEOUT_MS = 45_000

class RateLimited extends Error {
  readonly kind: AiErrorKind = 'RATE_LIMITED'
  constructor(public retryAfterMs: number) {
    super('rate limited')
  }
}

/** A bad/expired key — parking it stops us wasting an attempt slot on it. */
class AuthFailed extends Error {
  readonly kind: AiErrorKind = 'AUTH'
}

/** Any other provider-side failure, bucketed for the dashboard. */
class ProviderError extends Error {
  constructor(
    message: string,
    public kind: AiErrorKind,
  ) {
    super(message)
  }
}

/** Map a thrown error onto a dashboard bucket. */
function errorKindOf(err: unknown): AiErrorKind {
  if (err instanceof RateLimited || err instanceof AuthFailed) return err.kind
  if (err instanceof ProviderError) return err.kind
  if (err instanceof SyntaxError) return 'INVALID_JSON' // JSON.parse threw
  if (err instanceof Error && err.name === 'AbortError') return 'TIMEOUT'
  return 'UNKNOWN'
}

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
  apiKey(): string | undefined
  generate(prompt: string, geminiSchema: object, signal: AbortSignal): Promise<ProviderReply>
}

// ── Rate-limit / health bookkeeping ───────────────────────────────────────
// In-memory and per-instance, like the coach throttle. A serverless instance
// that never sees a 429 never parks anyone, which is the correct default: the
// cost of being wrong is one wasted call that immediately fails over.

interface Health {
  cooldownUntil: number
  /** Requests left in the current window, when the provider tells us. */
  remaining: number | null
  lastError: string | null
}

const health = new Map<ProviderId, Health>()

function healthOf(id: ProviderId): Health {
  let h = health.get(id)
  if (!h) {
    h = { cooldownUntil: 0, remaining: null, lastError: null }
    health.set(id, h)
  }
  return h
}

function park(id: ProviderId, ms: number, reason: string): void {
  const h = healthOf(id)
  h.cooldownUntil = Math.max(h.cooldownUntil, Date.now() + ms)
  h.lastError = reason
}

function isAvailable(p: Provider): boolean {
  return Boolean(p.apiKey()) && healthOf(p.id).cooldownUntil <= Date.now()
}

/** Snapshot for logging/debugging. */
export function providerHealth() {
  return PROVIDERS.map((p) => {
    const h = healthOf(p.id)
    return {
      id: p.id,
      configured: Boolean(p.apiKey()),
      available: isAvailable(p),
      cooldownMsLeft: Math.max(0, h.cooldownUntil - Date.now()),
      remaining: h.remaining,
      lastError: h.lastError,
    }
  })
}

/** Groq reports resets as "1m26.4s" / "210ms" / "2.5s". */
function parseDuration(v: string | null): number | null {
  if (!v) return null
  const trimmed = v.trim()
  // A bare number in Retry-After means seconds.
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const re = /([\d.]+)(ms|s|m|h)/g
  let ms = 0
  let matched = false
  for (const [, num, unit] of trimmed.matchAll(re)) {
    matched = true
    const n = Number(num)
    ms += unit === 'ms' ? n : unit === 's' ? n * 1000 : unit === 'm' ? n * 60_000 : n * 3_600_000
  }
  return matched ? ms : null
}

/** Read whatever rate-limit signal a response carries, and park if exhausted. */
function recordRateLimit(id: ProviderId, res: Response): void {
  const h = healthOf(id)
  const remaining = res.headers.get('x-ratelimit-remaining-requests')
  if (remaining !== null) {
    h.remaining = Number(remaining)
    if (h.remaining <= 0) {
      const reset = parseDuration(res.headers.get('x-ratelimit-reset-requests')) ?? DEFAULT_COOLDOWN_MS
      park(id, reset, 'request quota exhausted')
    }
  }
}

async function throwForStatus(id: ProviderId, res: Response): Promise<never> {
  const body = await res.text().catch(() => '')
  if (res.status === 429) {
    const retryAfter =
      parseDuration(res.headers.get('retry-after')) ??
      parseDuration(res.headers.get('x-ratelimit-reset-requests')) ??
      // Gemini puts `"retryDelay": "34s"` in the error body.
      parseDuration(/"retryDelay"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? null) ??
      DEFAULT_COOLDOWN_MS
    throw new RateLimited(retryAfter)
  }
  if (res.status === 401 || res.status === 403) {
    throw new AuthFailed(`${id} rejected the API key (${res.status})`)
  }
  // 400 is a malformed request (usually a schema the provider won't accept),
  // not a dead provider — fail over, but never park it.
  const kind: AiErrorKind = res.status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR'
  throw new ProviderError(`${id} responded ${res.status}: ${body.slice(0, 300)}`, kind)
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
  // The Hive is pinned to key #2 so it can't exhaust the quota the voice labs
  // share on GEMINI_API_KEY.
  apiKey: () => process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY,
  async generate(prompt, geminiSchema, signal) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': gemini.apiKey()! },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: geminiSchema,
          },
        }),
      },
    )
    recordRateLimit('gemini', res)
    if (!res.ok) await throwForStatus('gemini', res)
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
  apiKey: () => process.env.GROQ_API_KEY,
  async generate(prompt, geminiSchema, signal) {
    // Groq's strict mode requires every property to be listed in `required`
    // and forbids extra keys, so optional fields are made required-but-empty.
    const schema = requireAllProperties(toJsonSchema(geminiSchema))
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${groq.apiKey()}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'hive_response', strict: true, schema },
        },
      }),
    })
    recordRateLimit('groq', res)
    if (!res.ok) await throwForStatus('groq', res)
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
  apiKey: () => process.env.OLLAMA_API_KEY,
  async generate(prompt, geminiSchema, signal) {
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
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ollama.apiKey()}` },
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
    recordRateLimit('ollama', res)
    if (!res.ok) await throwForStatus('ollama', res)
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

// Rotates the starting provider so successive posts spread across the fleet
// instead of hammering whichever one is first.
let rotation = 0

/**
 * Available providers, rotated so the same one doesn't always go first.
 *
 * `adminParked` is the admin kill switch — distinct from the automatic
 * rate-limit cooldown that `isAvailable` checks. An admin parks a provider
 * because its bill or its output is wrong; the cooldown parks it because it
 * said 429. Both remove it from rotation, and neither should resurrect it.
 */
function attemptOrder(adminParked: ReadonlySet<ProviderId>): Provider[] {
  const available = PROVIDERS.filter((p) => isAvailable(p) && !adminParked.has(p.id))
  if (available.length <= 1) return available
  const start = rotation++ % available.length
  return [...available.slice(start), ...available.slice(0, start)]
}

/** The set of providers an admin has switched off. */
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

export class AllProvidersFailed extends Error {
  constructor(public attempts: { id: ProviderId; error: string }[]) {
    super(
      attempts.length === 0
        ? 'no AI provider available: every provider is unconfigured or cooling down'
        : `all AI providers failed: ${attempts.map((a) => `${a.id} (${a.error})`).join('; ')}`,
    )
    this.name = 'AllProvidersFailed'
  }
}

/**
 * Generate a structured response, failing over between providers.
 *
 * Tries up to MAX_PROVIDER_ATTEMPTS providers. A rate-limited provider is
 * parked until its limit resets and is skipped by later calls. When every
 * attempt fails the caller (runAiAttempt) escalates the post to a mentor.
 */
export interface GenerationResult<T> {
  data: T
  /** Which provider actually answered — recorded on the post's timeline. */
  provider: ProviderId
}

/**
 * Like generateStructured, but also tells you who answered.
 *
 * Every provider call — success or failure — writes one AiUsageEvent, so the
 * admin dashboard sees the failovers, not just the answer that eventually
 * landed. `ctx` says what the call was for.
 */
export async function generateStructuredWithMeta<T>(
  prompt: string,
  geminiSchema: object,
  ctx: HiveCallContext,
): Promise<GenerationResult<T>> {
  const attempts: { id: ProviderId; error: string }[] = []
  const order = attemptOrder(await adminParkedProviders()).slice(0, MAX_PROVIDER_ATTEMPTS)

  if (order.length === 0) {
    void recordAiUsage({
      feature: 'HIVE',
      ...ctx,
      provider: 'GEMINI', // no provider was reachable; the row records the gap
      model: 'none',
      success: false,
      latencyMs: 0,
      tryIndex: 0,
      errorKind: 'NO_PROVIDER',
      errorMessage: 'every provider is unconfigured or cooling down',
    })
    throw new AllProvidersFailed(attempts)
  }

  for (const [index, provider] of order.entries()) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const startedAt = Date.now()
    try {
      const reply = await provider.generate(prompt, geminiSchema, controller.signal)
      const parsed = JSON.parse(reply.text) as T
      healthOf(provider.id).lastError = null
      void recordAiUsage({
        feature: 'HIVE',
        ...ctx,
        provider: PROVIDER_ENUM[provider.id],
        model: provider.model,
        success: true,
        latencyMs: Date.now() - startedAt,
        tryIndex: index + 1,
        tokens: reply.tokens,
        confidence: typeof (parsed as { confidence?: unknown })?.confidence === 'number'
          ? (parsed as { confidence: number }).confidence
          : undefined,
      })
      return { data: parsed, provider: provider.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      const kind = errorKindOf(err)

      // Only a rate limit or a rejected key takes a provider out of rotation.
      // A one-off 500, timeout or malformed body must not park it — that would
      // let a single bad post cascade into a Hive-wide outage.
      if (err instanceof RateLimited) {
        park(provider.id, err.retryAfterMs, 'rate limited')
        attempts.push({ id: provider.id, error: `rate limited for ${Math.round(err.retryAfterMs / 1000)}s` })
      } else if (err instanceof AuthFailed) {
        park(provider.id, AUTH_COOLDOWN_MS, message)
        attempts.push({ id: provider.id, error: message })
      } else {
        healthOf(provider.id).lastError = message
        attempts.push({ id: provider.id, error: message })
      }

      void recordAiUsage({
        feature: 'HIVE',
        ...ctx,
        provider: PROVIDER_ENUM[provider.id],
        model: provider.model,
        success: false,
        latencyMs: Date.now() - startedAt,
        tryIndex: index + 1,
        errorKind: kind,
        errorMessage: message,
      })

      // Switch provider immediately. Logged because a provider that quietly
      // always loses the race is invisible otherwise — its lastError gets
      // cleared by its next success on a different call.
      console.warn(`[hive] provider ${provider.id} failed (${kind}), failing over:`, message)
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
