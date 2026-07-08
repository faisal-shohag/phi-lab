// Client-safe profile helpers: types, completion scoring, and input parsing.
// No Prisma import here, so client components (edit dialog, completion nudge) can
// use `completion()` without pulling server-only pg into the browser bundle.
// Server-only reads live in ./info.ts.

export interface ProfileInfo {
  headline: string | null
  bio: string | null
  goal: string | null
  skills: string[]
  location: string | null
  resumeUrl: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  websiteUrl: string | null
  profilePublic: boolean
}

/** The empty profile — used as a fallback and to type the editable shape. */
export const EMPTY_PROFILE: ProfileInfo = {
  headline: null,
  bio: null,
  goal: null,
  skills: [],
  location: null,
  resumeUrl: null,
  githubUrl: null,
  linkedinUrl: null,
  websiteUrl: null,
  profilePublic: false,
}

// ---- Completion scoring -----------------------------------------------------

export interface CompletionItem {
  key: string
  label: string
  done: boolean
}

export interface Completion {
  percent: number
  filled: number
  total: number
  items: CompletionItem[]
  missing: CompletionItem[]
}

/**
 * Score how complete a profile is against a fixed checklist. Pure — safe on the
 * client so the edit dialog can preview the percent live.
 */
export function completion(info: ProfileInfo): Completion {
  const items: CompletionItem[] = [
    { key: 'headline', label: 'Add a headline', done: !!info.headline?.trim() },
    { key: 'bio', label: 'Write a short bio', done: !!info.bio?.trim() },
    { key: 'goal', label: 'Set a career goal', done: !!info.goal?.trim() },
    { key: 'skills', label: 'List your skills', done: info.skills.length > 0 },
    { key: 'location', label: 'Add your location', done: !!info.location?.trim() },
    { key: 'resumeUrl', label: 'Link your resume', done: !!info.resumeUrl?.trim() },
    {
      key: 'socials',
      label: 'Add a social or website link',
      done: !!(info.githubUrl?.trim() || info.linkedinUrl?.trim() || info.websiteUrl?.trim()),
    },
  ]
  const filled = items.filter((i) => i.done).length
  const total = items.length
  return {
    percent: Math.round((filled / total) * 100),
    filled,
    total,
    items,
    missing: items.filter((i) => !i.done),
  }
}

// ---- Input parsing / validation ---------------------------------------------

const LIMITS = {
  headline: 80,
  bio: 400,
  goal: 160,
  location: 80,
  skill: 32,
  skills: 20,
  url: 300,
}

export class ProfileInputError extends Error {}

/** Trim to null (empty string becomes null so cleared fields persist as null). */
function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!t) return null
  return t.slice(0, max)
}

/** Validate an http(s) URL, or null. Throws ProfileInputError on a bad value. */
function url(value: unknown, field: string): string | null {
  const t = str(value, LIMITS.url)
  if (t === null) return null
  let parsed: URL
  try {
    parsed = new URL(t)
  } catch {
    throw new ProfileInputError(`${field} must be a valid URL (starting with https://).`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ProfileInputError(`${field} must be an http(s) link.`)
  }
  return t
}

/**
 * Parse and validate the PATCH body into the exact shape Prisma expects. Unknown
 * keys are ignored; every editable field is optional. Throws ProfileInputError
 * with a user-friendly message on bad input.
 */
export function parseProfileInput(body: unknown): ProfileInfo {
  const b = (body ?? {}) as Record<string, unknown>

  let skills: string[] = []
  if (Array.isArray(b.skills)) {
    skills = b.skills
      .map((s) => (typeof s === 'string' ? s.trim().slice(0, LIMITS.skill) : ''))
      .filter(Boolean)
    // de-dupe (case-insensitive) and cap the count
    const seen = new Set<string>()
    skills = skills
      .filter((s) => {
        const k = s.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, LIMITS.skills)
  }

  return {
    headline: str(b.headline, LIMITS.headline),
    bio: str(b.bio, LIMITS.bio),
    goal: str(b.goal, LIMITS.goal),
    skills,
    location: str(b.location, LIMITS.location),
    resumeUrl: url(b.resumeUrl, 'Resume link'),
    githubUrl: url(b.githubUrl, 'GitHub link'),
    linkedinUrl: url(b.linkedinUrl, 'LinkedIn link'),
    websiteUrl: url(b.websiteUrl, 'Website link'),
    profilePublic: b.profilePublic === true,
  }
}
