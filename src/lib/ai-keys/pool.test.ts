// The pool's two load-bearing promises: it finds every key the environment
// offers (so adding one is an .env edit, never a code change), and it actually
// spreads load across them (so the keys are worth having).
//
// Prisma is mocked — the health mirror is fire-and-forget telemetry, and a unit
// test must not write rows to the real database.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiKeyHealth: {
      upsert: vi.fn(() => Promise.resolve()),
      findMany: vi.fn(() => Promise.resolve([])),
    },
  },
}))

const NONE = new Set<string>()

/**
 * A fresh copy of the module per test. The pool memoizes discovery and keeps its
 * health/cursor state at module scope — which is right in production and poison
 * across tests.
 */
async function loadPool(env: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (/^(GEMINI|OLLAMA|GROQ)_API_KEY/.test(key)) delete process.env[key]
  }
  Object.assign(process.env, env)
  vi.resetModules()
  return import('./pool')
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('discovery', () => {
  it('finds the unsuffixed key and every numbered one', async () => {
    const pool = await loadPool({
      GEMINI_API_KEY: 'a',
      GEMINI_API_KEY_0: 'b',
      GEMINI_API_KEY_1: 'c',
      GEMINI_API_KEY_7: 'd', // gaps are fine — nothing is sequential
    })
    expect(pool.keysFor('gemini').map((k) => k.keyId)).toEqual([
      'GEMINI_API_KEY',
      'GEMINI_API_KEY_0',
      'GEMINI_API_KEY_1',
      'GEMINI_API_KEY_7',
    ])
  })

  it('picks up a brand-new key with no code change', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_42: 'new' })
    expect(pool.keysFor('gemini').map((k) => k.keyId)).toContain('GEMINI_API_KEY_42')
  })

  it('dedupes by value, so one key copied into two vars is still one key', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'same', GEMINI_API_KEY_0: 'same' })
    expect(pool.keysFor('gemini')).toHaveLength(1)
  })

  it('ignores env vars that only look like keys, and empty ones', async () => {
    const pool = await loadPool({
      GEMINI_API_KEY: 'a',
      GEMINI_API_KEY_BACKUP: 'not-a-key',
      GEMINI_API_KEY_2: '   ',
    })
    expect(pool.keysFor('gemini').map((k) => k.keyId)).toEqual(['GEMINI_API_KEY'])
  })

  it('keeps each provider in its own pool', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', OLLAMA_API_KEY: 'b', GROQ_API_KEY_1: 'c' })
    expect(pool.providerConfigured()).toEqual({ gemini: true, ollama: true, groq: true })
    expect(pool.keysFor('groq').map((k) => k.keyId)).toEqual(['GROQ_API_KEY_1'])
  })

  it('reports a provider with no keys as unconfigured', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a' })
    expect(pool.providerConfigured().groq).toBe(false)
    expect(pool.availableKeys('groq', 'text', NONE)).toEqual([])
  })
})

describe('rotation', () => {
  it('spreads consecutive calls across every key instead of hammering the first', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b', GEMINI_API_KEY_2: 'c' })

    const firstChoices = Array.from(
      { length: 9 },
      () => pool.availableKeys('gemini', 'text', NONE)[0].keyId,
    )
    const counts = new Map<string, number>()
    for (const id of firstChoices) counts.set(id, (counts.get(id) ?? 0) + 1)

    // Three keys, nine calls, each key leads exactly three times.
    expect([...counts.values()]).toEqual([3, 3, 3])
  })

  it('always offers every usable key, so the caller can fail over', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    const order = pool.availableKeys('gemini', 'text', NONE)
    expect(order.map((k) => k.keyId).sort()).toEqual(['GEMINI_API_KEY', 'GEMINI_API_KEY_1'])
  })

  it('does not advance the cursor on a peek, so a chain builder cannot alias it', async () => {
    // Regression. The engine asks EVERY provider for its keys on every request but
    // only uses the leading one. When those peeks advanced the cursor, the key
    // rotation ticked in lockstep with the 3-provider rotation — and with three
    // Gemini keys the periods aliased, so GEMINI_API_KEY led every single time and
    // the other two keys never got a request.
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b', GEMINI_API_KEY_2: 'c' })

    const leaders: string[] = []
    for (let request = 0; request < 6; request++) {
      // Two peeks and one real use, exactly like a 3-provider chain build.
      pool.availableKeys('gemini', 'text', NONE, false)
      pool.availableKeys('gemini', 'text', NONE, false)
      if (request % 3 === 0) {
        leaders.push(pool.availableKeys('gemini', 'text', NONE, true)[0].keyId)
      }
    }

    // Gemini led twice, on two different keys — not the same one twice.
    expect(new Set(leaders).size).toBe(leaders.length)
  })

  it('gives live and text their own cursor, so a text burst cannot shove live onto a hot key', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })

    // Burn the text cursor. The live lane has not been used at all.
    pool.availableKeys('gemini', 'text', NONE)
    pool.availableKeys('gemini', 'text', NONE)
    pool.availableKeys('gemini', 'text', NONE)

    // Live still starts at the top of its own rotation.
    expect(pool.availableKeys('gemini', 'live', NONE)[0].keyId).toBe('GEMINI_API_KEY')
  })
})

describe('parking', () => {
  it('drops a rate-limited key from rotation, and only that key', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    const [first] = pool.keysFor('gemini')

    pool.park(first, 60_000, 'rate limited')

    const available = pool.availableKeys('gemini', 'text', NONE)
    expect(available.map((k) => k.keyId)).toEqual(['GEMINI_API_KEY_1'])
  })

  it('brings a key back once its cooldown expires', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    const [first] = pool.keysFor('gemini')

    pool.park(first, 60_000, 'rate limited')
    expect(pool.availableKeys('gemini', 'text', NONE)).toHaveLength(1)

    vi.useFakeTimers()
    vi.advanceTimersByTime(61_000)
    expect(pool.availableKeys('gemini', 'text', NONE)).toHaveLength(2)
  })

  it('honours the admin per-key kill switch', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    const parked = new Set(['GEMINI_API_KEY'])
    expect(pool.availableKeys('gemini', 'text', parked).map((k) => k.keyId)).toEqual([
      'GEMINI_API_KEY_1',
    ])
  })

  it('returns nothing when every key is parked, rather than serving a burnt one', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    for (const key of pool.keysFor('gemini')) pool.park(key, 60_000, 'rate limited')
    expect(pool.availableKeys('gemini', 'text', NONE)).toEqual([])
  })
})

describe('rate-limit parsing', () => {
  it('reads the formats the vendors actually send', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a' })
    expect(pool.parseDuration('30')).toBe(30_000) // bare Retry-After = seconds
    expect(pool.parseDuration('210ms')).toBe(210)
    expect(pool.parseDuration('2.5s')).toBe(2500)
    expect(pool.parseDuration('1m26.4s')).toBe(86_400) // Groq
    expect(pool.parseDuration(null)).toBeNull()
  })
})

describe('withKey', () => {
  it('parks a rate-limited key and retries on the next one', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    const seen: string[] = []

    const { result, keyId } = await pool.withKey('gemini', 'live', async (key) => {
      seen.push(key.keyId)
      if (seen.length === 1) throw Object.assign(new Error('quota exceeded'), { status: 429 })
      return 'token'
    })

    expect(seen).toHaveLength(2)
    expect(result).toBe('token')
    expect(keyId).toBe(seen[1])
    // The burnt key is out of rotation for the next caller too.
    expect(pool.availableKeys('gemini', 'text', NONE).map((k) => k.keyId)).toEqual([seen[1]])
  })

  it('does not burn the pool on an error that is not the key\'s fault', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })
    let calls = 0

    await expect(
      pool.withKey('gemini', 'live', async () => {
        calls++
        throw Object.assign(new Error('bad request'), { status: 400 })
      }),
    ).rejects.toThrow('bad request')

    expect(calls).toBe(1) // failed once, propagated — did not walk every key
    expect(pool.availableKeys('gemini', 'text', NONE)).toHaveLength(2)
  })

  it('throws AllKeysFailed when every key is spent', async () => {
    const pool = await loadPool({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_1: 'b' })

    await expect(
      pool.withKey('gemini', 'live', async () => {
        throw Object.assign(new Error('quota exceeded'), { status: 429 })
      }),
    ).rejects.toBeInstanceOf(pool.AllKeysFailed)
  })
})
