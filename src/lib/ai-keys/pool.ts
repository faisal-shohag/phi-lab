// The API key pool: who our keys are, which one goes next, and which are burnt.
// Server-only. Every AI call in the app — Hive, the JS Motion tutor, the report
// graders, the live voice token mints — draws its key from here.
//
// Keys are discovered from the environment BY CONVENTION, not by a hardcoded
// list:
//
//   GEMINI_API_KEY, GEMINI_API_KEY_0, GEMINI_API_KEY_1, … GEMINI_API_KEY_37
//   OLLAMA_API_KEY, OLLAMA_API_KEY_0, …
//   GROQ_API_KEY,   GROQ_API_KEY_0,   …
//
// Adding capacity is therefore an .env edit and a restart — never a code change.
// That is the whole point of this file existing.
//
// A key's IDENTITY is its env var name ("GEMINI_API_KEY_1"), and that is what we
// log, persist and render. The key's VALUE never leaves this module's memory: it
// is handed to a fetch header and nowhere else. A dashboard that showed a key
// prefix would be a dashboard that leaks keys to every admin's browser history.
//
// One caveat worth knowing when you add keys: rotation only buys real headroom if
// the Gemini keys belong to DIFFERENT Google Cloud projects. Two keys in one
// project share that project's quota, so rotating between them spreads per-key
// request rate but not the project's token budget.
import { prisma } from '@/lib/prisma'
import type { AiErrorKind, AiProvider } from '@/generated/prisma/client'

export type ProviderId = 'gemini' | 'ollama' | 'groq'

/**
 * Which lane a caller is in. Both lanes share the same keys, but each keeps its
 * own round-robin cursor, so a burst of Hive posts can't shove the live-voice
 * cursor onto the key it just hammered.
 */
export type Lane = 'live' | 'text'

export interface ApiKey {
  /** The env var name. Safe to log, persist and display. */
  keyId: string
  provider: ProviderId
  /** The secret. Never persist this, never send it to a browser. */
  value: string
}

/** ProviderId (internal, lowercase) → the Prisma enum stored on rows. */
export const PROVIDER_ENUM: Record<ProviderId, AiProvider> = {
  gemini: 'GEMINI',
  ollama: 'OLLAMA',
  groq: 'GROQ',
}

/** `PREFIX` or `PREFIX_<n>`, and nothing else — GEMINI_API_KEY_BACKUP is not a key. */
const PATTERN: Record<ProviderId, RegExp> = {
  gemini: /^GEMINI_API_KEY(?:_(\d+))?$/,
  ollama: /^OLLAMA_API_KEY(?:_(\d+))?$/,
  groq: /^GROQ_API_KEY(?:_(\d+))?$/,
}

const PROVIDER_IDS = Object.keys(PATTERN) as ProviderId[]

/** How long a key stays parked when a rate limit gives us no reset hint. */
const DEFAULT_COOLDOWN_MS = 60_000
/** A rejected key won't start working in the next few seconds. */
const AUTH_COOLDOWN_MS = 5 * 60_000
/** Distinct keys `withKey` will try before it gives up. */
const MAX_KEY_ATTEMPTS = 3

// ── Discovery ─────────────────────────────────────────────────────────────

let cache: Map<ProviderId, ApiKey[]> | null = null

function discover(): Map<ProviderId, ApiKey[]> {
  const out = new Map<ProviderId, ApiKey[]>(PROVIDER_IDS.map((p) => [p, []]))

  for (const provider of PROVIDER_IDS) {
    const found: { key: ApiKey; order: number }[] = []
    // Dedupe by value: GEMINI_API_KEY and GEMINI_API_KEY_0 holding the same
    // string are ONE key. Left as two, the pool would rotate a key against
    // itself and the dashboard would split its usage across two phantom rows.
    const seen = new Set<string>()

    for (const [name, raw] of Object.entries(process.env)) {
      const match = PATTERN[provider].exec(name)
      if (!match) continue
      const value = raw?.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      // Unsuffixed sorts first, then _0, _1, … so keyId order is identical in
      // every serverless instance — the cursors mean the same thing everywhere.
      found.push({ key: { keyId: name, provider, value }, order: match[1] === undefined ? -1 : Number(match[1]) })
    }

    out.set(
      provider,
      found.sort((a, b) => a.order - b.order).map((f) => f.key),
    )
  }

  return out
}

/**
 * process.env is fixed for the life of a process, so discovery runs once. A key
 * added to the environment appears on the next boot — which on Vercel is the next
 * deploy, and locally is the next `npm run dev`.
 */
function pool(): Map<ProviderId, ApiKey[]> {
  cache ??= discover()
  return cache
}

/** Test-only escape hatch: re-read process.env. */
export function resetPoolCache(): void {
  cache = null
}

export function keysFor(provider: ProviderId): ApiKey[] {
  return pool().get(provider) ?? []
}

export function allKeys(): ApiKey[] {
  return PROVIDER_IDS.flatMap((p) => keysFor(p))
}

/** Which providers have at least one key. Env logic stays in one place. */
export function providerConfigured(): Record<ProviderId, boolean> {
  const out = {} as Record<ProviderId, boolean>
  for (const p of PROVIDER_IDS) out[p] = keysFor(p).length > 0
  return out
}

// ── Error taxonomy ────────────────────────────────────────────────────────
// Lives here rather than in the Hive engine because the live token routes need
// to classify the same failures, and a second copy of this would drift.

export class RateLimited extends Error {
  readonly kind: AiErrorKind = 'RATE_LIMITED'
  constructor(public retryAfterMs: number) {
    super('rate limited')
  }
}

/** A bad/expired key — parking it stops us wasting an attempt slot on it. */
export class AuthFailed extends Error {
  readonly kind: AiErrorKind = 'AUTH'
}

/** Any other provider-side failure, bucketed for the dashboard. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: AiErrorKind,
  ) {
    super(message)
  }
}

/** Map a thrown error onto a dashboard bucket. */
export function errorKindOf(err: unknown): AiErrorKind {
  if (err instanceof RateLimited || err instanceof AuthFailed) return err.kind
  if (err instanceof ProviderError) return err.kind
  if (err instanceof SyntaxError) return 'INVALID_JSON' // JSON.parse threw
  if (err instanceof Error && err.name === 'AbortError') return 'TIMEOUT'
  return 'UNKNOWN'
}

// ── Health bookkeeping ────────────────────────────────────────────────────
// In-memory and per-instance. An instance that never sees a 429 never parks
// anyone, which is the correct default: the cost of being wrong is one wasted
// call that immediately fails over to the next key.

interface KeyHealth {
  cooldownUntil: number
  /** Requests left in the current window, when the vendor tells us. Groq only. */
  remaining: number | null
  lastError: string | null
}

const health = new Map<string, KeyHealth>()

function healthOf(keyId: string): KeyHealth {
  let h = health.get(keyId)
  if (!h) {
    h = { cooldownUntil: 0, remaining: null, lastError: null }
    health.set(keyId, h)
  }
  return h
}

/**
 * Mirror this key's health into `api_key_health` for the admin dashboard, which
 * runs in a different instance and can't see the in-memory Map. Best-effort and
 * fire-and-forget, exactly like recordAiUsage: a telemetry write must never fail
 * a generation or hold up the caller.
 */
function persistHealth(key: ApiKey): void {
  const h = healthOf(key.keyId)
  const cooldownUntil = h.cooldownUntil > Date.now() ? new Date(h.cooldownUntil) : null
  const fields = { remaining: h.remaining, cooldownUntil, lastError: h.lastError }
  void prisma.apiKeyHealth
    .upsert({
      where: { keyId: key.keyId },
      // adminParked is deliberately absent from `update` — it is the admin's
      // column, and a routine health write must not clear their kill switch.
      create: { keyId: key.keyId, provider: PROVIDER_ENUM[key.provider], ...fields },
      update: fields,
    })
    .catch(() => {})
}

export function park(key: ApiKey, ms: number, reason: string): void {
  const h = healthOf(key.keyId)
  h.cooldownUntil = Math.max(h.cooldownUntil, Date.now() + ms)
  h.lastError = reason
  persistHealth(key)
}

/** A key that just worked is a key with nothing wrong with it. */
export function clearError(key: ApiKey): void {
  healthOf(key.keyId).lastError = null
}

export function noteError(key: ApiKey, message: string): void {
  healthOf(key.keyId).lastError = message
}

function isAvailable(key: ApiKey, parked: ReadonlySet<string>): boolean {
  return !parked.has(key.keyId) && healthOf(key.keyId).cooldownUntil <= Date.now()
}

/** Snapshot of the in-memory health, for logging and /api/hive/health. */
export function keyHealth() {
  return allKeys().map((key) => {
    const h = healthOf(key.keyId)
    return {
      keyId: key.keyId,
      provider: key.provider,
      available: h.cooldownUntil <= Date.now(),
      cooldownMsLeft: Math.max(0, h.cooldownUntil - Date.now()),
      remaining: h.remaining,
      lastError: h.lastError,
    }
  })
}

/**
 * Keys an admin has switched off, from `api_key_health.adminParked`. Distinct
 * from the automatic cooldown: an admin parks a key because its bill or its
 * owner is wrong, the cooldown parks it because the vendor said 429.
 *
 * A database outage must not take the whole fleet offline, so it parks nothing.
 */
export async function adminParkedKeys(): Promise<ReadonlySet<string>> {
  try {
    const rows = await prisma.apiKeyHealth.findMany({
      where: { adminParked: true },
      select: { keyId: true },
    })
    return new Set(rows.map((r) => r.keyId))
  } catch {
    return new Set()
  }
}

// ── Rate-limit parsing ────────────────────────────────────────────────────

/** Groq reports resets as "1m26.4s" / "210ms" / "2.5s". */
export function parseDuration(v: string | null): number | null {
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

/** Read whatever rate-limit signal a response carries, and park the key if it's spent. */
export function recordRateLimit(key: ApiKey, res: Response): void {
  const h = healthOf(key.keyId)
  const remaining = res.headers.get('x-ratelimit-remaining-requests')
  if (remaining !== null) {
    h.remaining = Number(remaining)
    if (h.remaining <= 0) {
      const reset = parseDuration(res.headers.get('x-ratelimit-reset-requests')) ?? DEFAULT_COOLDOWN_MS
      park(key, reset, 'request quota exhausted') // park() already persists
    } else {
      persistHealth(key)
    }
  }
}

export async function throwForStatus(key: ApiKey, res: Response): Promise<never> {
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
    throw new AuthFailed(`${key.provider} rejected ${key.keyId} (${res.status})`)
  }
  // 400 is a malformed request (usually a schema the provider won't accept), not
  // a dead key — fail over, but never park it.
  const kind: AiErrorKind = res.status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR'
  throw new ProviderError(`${key.provider} responded ${res.status}: ${body.slice(0, 300)}`, kind)
}

/**
 * Park a key for a failure that came back through an SDK rather than a raw
 * `fetch` — the live token mint, which throws instead of handing us a Response.
 * Returns true if the key was taken out of rotation.
 */
export function parkForSdkError(key: ApiKey, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  const message = err instanceof Error ? err.message : String(err)
  const looks = (needle: string) => message.toLowerCase().includes(needle)

  if (status === 429 || looks('resource_exhausted') || looks('quota')) {
    const hinted = parseDuration(/"retryDelay"\s*:\s*"([^"]+)"/.exec(message)?.[1] ?? null)
    park(key, hinted ?? DEFAULT_COOLDOWN_MS, 'rate limited')
    return true
  }
  if (status === 401 || status === 403 || looks('api key not valid') || looks('permission_denied')) {
    park(key, AUTH_COOLDOWN_MS, message.slice(0, 200))
    return true
  }
  noteError(key, message.slice(0, 200))
  return false
}

// ── Selection ─────────────────────────────────────────────────────────────

/** One cursor per (provider, lane) — see the Lane doc comment. */
const cursors = new Map<string, number>()

function cursorFor(provider: ProviderId, lane: Lane, size: number, advance: boolean): number {
  const slot = `${provider}:${lane}`
  const n = cursors.get(slot) ?? 0
  if (advance) cursors.set(slot, n + 1)
  return n % size
}

/**
 * This provider's usable keys, rotated so the same one doesn't always go first.
 * Empty when every key is cooling down, parked, or the provider has none.
 *
 * `advance` is the subtle part. A caller that builds a chain across ALL providers
 * asks every provider for its keys on every request, but only actually USES the
 * one that leads. If that peek advanced the cursor, the key cursor would tick in
 * lockstep with the provider rotation — and when the two periods share a factor
 * (three providers, three Gemini keys) they alias: Gemini leads every third
 * request, by which point its key cursor has wrapped back to the same key, and
 * the other keys never lead at all. So a peek must not advance; only the provider
 * that is about to go first does.
 */
export function availableKeys(
  provider: ProviderId,
  lane: Lane,
  parked: ReadonlySet<string>,
  advance = true,
): ApiKey[] {
  const usable = keysFor(provider).filter((k) => isAvailable(k, parked))
  if (usable.length <= 1) return usable
  const start = cursorFor(provider, lane, usable.length, advance)
  return [...usable.slice(start), ...usable.slice(0, start)]
}

export class AllKeysFailed extends Error {
  constructor(
    public provider: ProviderId,
    public attempts: { keyId: string; error: string }[],
  ) {
    super(
      attempts.length === 0
        ? `no ${provider} key available: none configured, or all are parked or cooling down`
        : `all ${provider} keys failed: ${attempts.map((a) => `${a.keyId} (${a.error})`).join('; ')}`,
    )
    this.name = 'AllKeysFailed'
  }
}

/**
 * Run `fn` against this provider's keys until one of them works.
 *
 * For callers that talk to a vendor SDK and so can't use the Hive engine's
 * failover — i.e. the four live token routes. A rate-limited or rejected key is
 * parked and the next key is tried; any other error is not the key's fault, so it
 * propagates immediately rather than burning the pool on a bug in our own request.
 *
 * The Hive engine does NOT use this: it fails over across providers as well as
 * keys, so it drives `availableKeys` directly.
 */
export async function withKey<T>(
  provider: ProviderId,
  lane: Lane,
  fn: (key: ApiKey) => Promise<T>,
): Promise<{ result: T; keyId: string }> {
  const candidates = availableKeys(provider, lane, await adminParkedKeys()).slice(0, MAX_KEY_ATTEMPTS)
  const attempts: { keyId: string; error: string }[] = []

  for (const key of candidates) {
    try {
      const result = await fn(key)
      clearError(key)
      return { result, keyId: key.keyId }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      if (!parkForSdkError(key, err)) throw err // not the key's fault — don't mask it
      attempts.push({ keyId: key.keyId, error: message })
      console.warn(`[ai-keys] ${key.keyId} parked, trying the next key:`, message)
    }
  }

  throw new AllKeysFailed(provider, attempts)
}
