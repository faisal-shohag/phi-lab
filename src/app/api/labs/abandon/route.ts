// The learner walked away mid-round.
//
// A live round only reaches a terminal status by producing a report. Close the
// tab and nothing runs: the socket dies with the page and the row sits at
// IN_PROGRESS forever, counted as a live session that never ended. This is the
// endpoint the page hits on its way out.
//
// Sent with sendBeacon from the hooks' unmount cleanup, so it inherits that
// contract: fire-and-forget, no response worth reading, and a payload the browser
// may deliver after the page is gone. Same shape as /api/ai-usage/live, which
// solves the same "report something as the tab closes" problem — including its
// anti-abuse anchor: the session must exist and belong to the caller, or a signed-
// in user could abandon someone else's round.
//
// Never clobbers a finished round: only IN_PROGRESS (support: 'active') moves.
// The per-lab rules live in abandonSession() — shared with the admin force-end on
// the labs monitor, so the two can't drift apart about what "abandoned" means.
import { requireUser } from '@/lib/auth-server'
import { abandonSession, type LiveFeature } from '@/lib/labs/abandon'

const LIVE_FEATURES = ['INTERVIEW', 'FEYNMAN', 'ENGLISH', 'SUPPORT'] as const

function isLiveFeature(v: unknown): v is LiveFeature {
  return typeof v === 'string' && (LIVE_FEATURES as readonly string[]).includes(v)
}

export async function POST(request: Request) {
  // 204 rather than 401: the page sending this is already unloading. There is
  // nothing it could do with an error, and nothing to show the user.
  const user = await requireUser()
  if (!user) return new Response(null, { status: 204 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return new Response(null, { status: 204 })
  }

  const { feature, sessionId } = body
  if (!isLiveFeature(feature) || typeof sessionId !== 'string' || !sessionId) {
    return new Response(null, { status: 204 })
  }

  try {
    // Scoped to the owner: a signed-in user must not be able to end someone
    // else's round by guessing an id.
    await abandonSession(feature, sessionId, { userId: user.id })
  } catch {
    // The cron sweep will catch anything that slips through here.
  }

  return new Response(null, { status: 204 })
}
