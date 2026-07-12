// POST /api/admin/labs/end  { feature, sessionId }
//
// Force-ends a live lab session from the admin monitor: the escape hatch for a
// round wedged at IN_PROGRESS whose learner is long gone (a killed browser, a
// slept laptop — the cases the unload beacon cannot cover). Without it an admin
// waits up to two hours for the cron sweep, and for Support that means a
// concurrency slot stays hostage while a queue forms behind it.
//
// This is an admin mutating a row belonging to someone else, so unlike the
// learner's own /api/labs/abandon it is (a) not owner-scoped, (b) audited, and
// (c) behind withAdmin — the (admin) layout guards pages, not fetches.
import { withAdmin } from '@/lib/admin/guard'
import { writeAudit } from '@/lib/admin/audit'
import { abandonSession, type LiveFeature } from '@/lib/labs/abandon'
import { hiveError } from '@/lib/hive/errors'

const LIVE_FEATURES = ['INTERVIEW', 'FEYNMAN', 'ENGLISH', 'SUPPORT'] as const

function isLiveFeature(v: unknown): v is LiveFeature {
  return typeof v === 'string' && (LIVE_FEATURES as readonly string[]).includes(v)
}

export async function POST(request: Request) {
  return withAdmin(async (actor) => {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return hiveError('VALIDATION', 'Invalid JSON body.')
    }

    const { feature, sessionId } = body
    if (!isLiveFeature(feature)) {
      return hiveError('VALIDATION', 'Expected `feature` to be one of INTERVIEW, FEYNMAN, ENGLISH, SUPPORT.')
    }
    if (typeof sessionId !== 'string' || !sessionId) {
      return hiveError('VALIDATION', 'Expected a `sessionId`.')
    }

    // False means nothing moved: the session had already ended between the
    // monitor rendering and the click. That is not an error — the admin wanted it
    // ended and it is ended — but it must not be audited as an action that
    // happened, or the trail claims a mutation that never occurred.
    const ended = await abandonSession(feature, sessionId)

    if (ended) {
      await writeAudit({
        actorId: actor.id,
        action: 'lab.session.force_end',
        targetType: 'session',
        targetId: sessionId,
        before: { feature, status: 'live' },
        after: { feature, status: 'ABANDONED' },
      })
    }

    return Response.json({ ended })
  })
}
