import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from './auth'

/**
 * Reads the current better-auth session inside a Server Component or Route
 * Handler. Returns the authenticated user, or null if there is no session.
 * `headers()` is async in this Next.js version, so it must be awaited.
 *
 * Wrapped in React cache() so a layout and its child page calling this in
 * the same render pass share one getSession() round trip instead of two.
 */
export const requireUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
})
