import { headers } from 'next/headers'
import { auth } from './auth'

/**
 * Reads the current better-auth session inside a Server Component or Route
 * Handler. Returns the authenticated user, or null if there is no session.
 * `headers()` is async in this Next.js version, so it must be awaited.
 */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}
