// Serve a challenge's target render.
//
// The target is rendered from the reference on demand (lib/pixel/target.ts), not
// read from a file, so this route is the one place that decides who may see one
// — and it refuses `brief` outright. That is what makes `brief` mean anything:
// its whole premise is that you cannot submit back an image you have never been
// shown. A file in public/ would be one guessed URL away from breaking that,
// since the challenge id ships in the client catalog.
//
// Rendering costs real CPU on a plan that meters it, so the caching here is not
// housekeeping. The ETag is a hash of the reference source, which means a
// conditional request is answered without launching anything, and editing a
// reference changes the hash and invalidates every cached copy by itself.

import { requireUser } from '@/lib/auth-server'
import { challengeById } from '@/lib/pixel/challenges'
import { getTarget, targetEtag } from '@/lib/pixel/target'

export const runtime = 'nodejs'

export async function GET(request: Request, ctx: RouteContext<'/api/labs/pixel-lab/target/[id]'>) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const { id } = await ctx.params
  const challenge = challengeById(id)
  if (!challenge) return Response.json({ error: 'UNKNOWN_CHALLENGE' }, { status: 404 })

  // The point of the whole arrangement. Not 403: acknowledging that a target
  // exists but is withheld invites someone to go looking for it.
  if (challenge.kind === 'brief') {
    return Response.json({ error: 'NO_TARGET' }, { status: 404 })
  }

  const etag = targetEtag(challenge.id)
  if (!etag) return Response.json({ error: 'NO_REFERENCE' }, { status: 404 })

  // Before the render, deliberately — this is the branch that makes repeat views
  // free.
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': CACHE } })
  }

  try {
    const target = await getTarget(challenge.id)
    return new Response(new Uint8Array(target.png), {
      headers: { 'Content-Type': 'image/png', ETag: etag, 'Cache-Control': CACHE },
    })
  } catch {
    // An authoring gap — the reference is missing or does not render. Nothing the
    // learner can do, so do not dress it up as their 404.
    return Response.json({ error: 'TARGET_UNAVAILABLE' }, { status: 503 })
  }
}

/**
 * `private` — the browser may cache this, no shared cache may.
 *
 * Tempting to make it `public` with an `s-maxage` so the CDN absorbs the load,
 * and wrong: a shared cache hit never reaches this route, so the `requireUser`
 * above would gate exactly one person — the first — and serve everyone after
 * them, signed in or not. A cache directive that skips your auth check is an
 * auth bypass with good intentions.
 *
 * It costs little to be correct here. The reference render is memoised per
 * process (target.ts), so repeat views cost an invocation and no Chromium, and
 * the ETag turns most of them into a 304 with no body either.
 */
const CACHE = 'private, max-age=3600'
