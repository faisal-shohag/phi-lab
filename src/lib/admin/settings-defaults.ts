// The full set of admin-tunable knobs, with the values the platform shipped
// with. These defaults are the contract: an empty `admin_setting` table must
// behave exactly like the hardcoded constants they replaced.
//
// Framework-free (no prisma import) so client components can render a settings
// form against the same key list the server resolves against.

export const SETTING_DEFAULTS = {
  // Live round length, in seconds. Flows server -> token response -> hook.
  'lab.interview.roundSeconds': 180,
  'lab.feynman.roundSeconds': 180,
  'lab.english.roundSeconds': 180,
  'lab.support.roundSeconds': 600,

  // Fresh sessions a user may start per UTC day.
  'lab.interview.dailyLimit': 10,
  'lab.feynman.dailyLimit': 10,
  'lab.english.dailyLimit': 10,
  'lab.analogies.dailyLimit': 40,
  'lab.quiz.dailyLimit': 20,

  // Platform-wide concurrent live Support slots; everyone else queues.
  'lab.support.maxActiveSessions': 3,

  'hive.dailyCoachLimit': 20,

  // Kill switches. A disabled lab refuses to mint a token.
  'flag.lab.interview.enabled': true,
  'flag.lab.feynman.enabled': true,
  'flag.lab.english.enabled': true,
  'flag.lab.support.enabled': true,
  'flag.lab.analogies.enabled': true,
  'flag.lab.quiz.enabled': true,

  // Park switches. A parked provider is skipped in the Hive failover chain.
  'flag.provider.gemini.parked': false,
  'flag.provider.ollama.parked': false,
  'flag.provider.groq.parked': false,
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] }

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[]

/**
 * Bounds for the numeric knobs. The settings API clamps to these — an admin
 * typo of `6000` for a round length should not mint a 100-minute Gemini token.
 */
export const SETTING_BOUNDS: Partial<Record<SettingKey, { min: number; max: number }>> = {
  'lab.interview.roundSeconds': { min: 30, max: 1800 },
  'lab.feynman.roundSeconds': { min: 30, max: 1800 },
  'lab.english.roundSeconds': { min: 30, max: 1800 },
  'lab.support.roundSeconds': { min: 60, max: 3600 },
  'lab.interview.dailyLimit': { min: 0, max: 500 },
  'lab.feynman.dailyLimit': { min: 0, max: 500 },
  'lab.english.dailyLimit': { min: 0, max: 500 },
  'lab.analogies.dailyLimit': { min: 0, max: 500 },
  'lab.quiz.dailyLimit': { min: 0, max: 500 },
  'lab.support.maxActiveSessions': { min: 0, max: 50 },
  'hive.dailyCoachLimit': { min: 0, max: 500 },
}

/**
 * Coerce an untrusted value to the type its default declares, then clamp it.
 * Returns null when the value can't be salvaged, so callers can reject.
 */
export function coerceSetting(key: SettingKey, value: unknown): number | boolean | null {
  const fallback = SETTING_DEFAULTS[key]

  if (typeof fallback === 'boolean') {
    return typeof value === 'boolean' ? value : null
  }

  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  const bounds = SETTING_BOUNDS[key]
  const rounded = Math.round(n)
  if (!bounds) return rounded
  return Math.min(bounds.max, Math.max(bounds.min, rounded))
}
