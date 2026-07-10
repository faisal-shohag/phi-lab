// Hive role helpers. The base app (better-auth) has no role concept, so Hive
// adds a `role` column on User and seeds mentors lazily from the
// HIVE_MENTOR_EMAILS env list — a matching email is promoted to MENTOR the
// first time they touch Hive. Roles are now also managed from /admin/users.
//
// getHiveUser() reads the User row on every call, which makes it the natural
// place to enforce suspension: a suspended account resolves to null, so every
// Hive and admin surface treats them as signed out. The lab token routes do the
// equivalent check via isSuspended(), because they only call requireUser(),
// which reads the session cookie and never touches the database.
import { cache } from 'react'
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/generated/prisma/client'

export interface HiveUser {
  id: string
  name: string
  email: string
  image: string | null
  role: Role
}

function mentorEmails(): Set<string> {
  return new Set(
    (process.env.HIVE_MENTOR_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

/**
 * The authenticated user plus their Hive role. Returns null when signed out or
 * suspended. Idempotently promotes a STUDENT to MENTOR when their email is in
 * HIVE_MENTOR_EMAILS (one UPDATE only when the role actually changes).
 *
 * Wrapped in React cache() so the Hive/admin layout and the page it renders
 * share one DB lookup per request instead of each calling it separately.
 */
export const getHiveUser = cache(async (): Promise<HiveUser | null> => {
  const authed = await requireUser()
  if (!authed) return null

  const row = await prisma.user.findUnique({
    where: { id: authed.id },
    select: { id: true, name: true, email: true, image: true, role: true, suspendedAt: true },
  })
  if (!row) return null
  // A suspended account keeps a structurally valid session cookie for up to 30
  // days, so this DB read is the only thing standing between them and the app.
  if (row.suspendedAt) return null

  if (row.role === 'STUDENT' && mentorEmails().has(row.email.toLowerCase())) {
    const updated = await prisma.user.update({
      where: { id: row.id },
      data: { role: 'MENTOR' },
      select: { id: true, name: true, email: true, image: true, role: true },
    })
    return updated
  }
  return row
})

export function isMentor(user: HiveUser | null): boolean {
  return user?.role === 'MENTOR' || user?.role === 'ADMIN'
}

/**
 * Like getHiveUser but throws-shaped: returns { user } on success or a
 * ready-to-return error Response describing why not.
 */
export async function requireHiveUser(): Promise<
  { user: HiveUser; error?: undefined } | { user?: undefined; error: 'AUTH_REQUIRED' }
> {
  const user = await getHiveUser()
  if (!user) return { error: 'AUTH_REQUIRED' }
  return { user }
}

export function isAdmin(user: HiveUser | null): boolean {
  return user?.role === 'ADMIN'
}

export async function requireAdmin(): Promise<
  { user: HiveUser; error?: undefined } | { user?: undefined; error: 'AUTH_REQUIRED' | 'FORBIDDEN' }
> {
  const user = await getHiveUser()
  if (!user) return { error: 'AUTH_REQUIRED' }
  if (!isAdmin(user)) return { error: 'FORBIDDEN' }
  return { user }
}

export async function requireMentor(): Promise<
  { user: HiveUser; error?: undefined } | { user?: undefined; error: 'AUTH_REQUIRED' | 'FORBIDDEN' }
> {
  const user = await getHiveUser()
  if (!user) return { error: 'AUTH_REQUIRED' }
  if (!isMentor(user)) return { error: 'FORBIDDEN' }
  return { user }
}
