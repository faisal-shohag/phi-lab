// Shared Hive constants: post lifecycle, limits, and the curated tag list the
// triage step and composer both draw from. Kept framework-free so both server
// routes and client components can import them.

/** Questions live 7 days unless resolved+accepted (then archived permanently). */
export const POST_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** A "far future" expiry for announcements/encouragement (never auto-deleted). */
export const NEVER_EXPIRES = new Date('2999-01-01T00:00:00Z')

/** Max AI answer attempts before a post escalates to a human mentor. */
export const MAX_AI_ATTEMPTS = 3

// Composer / upload limits.
export const MAX_IMAGES_PER_POST = 4
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_TITLE_LEN = 140
export const MAX_BODY_LEN = 8000

// Daily rate limits (per user), enforced inline via XpEvent/row counts.
export const DAILY_POST_LIMIT = 30
/** Default only — the live value is admin-tunable via `hive.dailyCoachLimit`. */
export const DAILY_COACH_LIMIT = 20
export const DAILY_XP_REPLIES = 5 // replies that earn XP per day

/** Curated topic tags surfaced in the composer and used by triage. */
export const HIVE_TAGS = [
  'javascript',
  'typescript',
  'react',
  'nextjs',
  'nodejs',
  'express',
  'mongodb',
  'css',
  'html',
  'git',
  'deployment',
  'api',
  'auth',
  'async',
  'debugging',
  'tooling',
  'career',
  'other',
] as const

export type HiveTag = (typeof HIVE_TAGS)[number]

/** cloudinary folder all Hive uploads land in (fixed server-side). */
export const CLOUDINARY_FOLDER = 'philab/hive'
