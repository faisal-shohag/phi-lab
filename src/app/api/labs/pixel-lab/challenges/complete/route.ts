// Score a Pixel Lab submission and pay out the tiers it earned.
//
// ── What this proves ──
// The learner sends code. We render it, in a headless Chromium we control, and
// diff the result against the reference rendered by that same browser moments
// earlier. There is no image in the request, so there is nothing to forge: the
// only way to score is to send HTML and CSS that genuinely renders to the
// target. That is the challenge, so passing it *is* doing the work.
//
// This is a real change from the previous build, which rasterised the learner's
// iframe on their own machine and accepted the PNG. The target is on screen by
// necessity — you cannot reproduce what you cannot see — so it could be posted
// straight back for a guaranteed 100%, and no amount of server-side re-diffing
// closed that. The render moving here is what closed it.
//
// ── What it still does not prove ──
// That the learner wrote the code. Solutions can be shared, here as anywhere.
// And the target may be eyedropped, zoomed, measured — that is playing the game,
// not beating it.
//
// One cheat is worth naming because it is the first thing anyone clever tries:
// pasting the target back as `<img src="data:image/png;base64,...">`. It does not
// work, and not by luck — the sandbox CSP permits no images at all (harness.ts),
// which is why this lab is pure CSS and no challenge may ever ship an <img>.
//
// Do not let this comment grow claims the code cannot back — a previous build
// asserted forgery cost "collapses onto building cost" and testing disproved it.

import { requireUser } from '@/lib/auth-server'
import { isSuspended } from '@/lib/admin/suspension'
import { awardXp } from '@/lib/gamification/award'
import { challengeById } from '@/lib/pixel/challenges'
import { DiffSizeError, diffImages, matchPercent } from '@/lib/pixel/diff'
import { MAX_CSS, MAX_HTML } from '@/lib/pixel/harness'
import { getPixelProgress } from '@/lib/pixel/progress'
import { takeRenderToken } from '@/lib/pixel/rate-limit'
import { RenderError, renderToPng } from '@/lib/pixel/render'
import { recordSubmission } from '@/lib/pixel/submissions'
import { getTarget } from '@/lib/pixel/target'
import { isUnlocked, newlyUnlocked, type TiersByChallenge } from '@/lib/pixel/unlock'
import {
  PERFECT_AT,
  TIER_REASON,
  nextTierAt,
  scoreFrom,
  sourceIdFor,
  tiersFor,
  xpFor,
  type Tier,
} from '@/lib/pixel/score'
import { PNG } from 'pngjs'

export const runtime = 'nodejs'

function fail(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: code, message, ...extra }, { status })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED', 'Sign in to submit a build.', 401)
  if (await isSuspended(user.id)) return fail('SUSPENDED', 'Your account is suspended.', 403)

  let challengeId = ''
  let html = ''
  let css = ''
  try {
    const body = await request.json()
    if (typeof body?.challengeId === 'string') challengeId = body.challengeId
    if (typeof body?.html === 'string') html = body.html.slice(0, MAX_HTML)
    if (typeof body?.css === 'string') css = body.css.slice(0, MAX_CSS)
  } catch {
    return fail('BAD_REQUEST', 'Invalid JSON body.', 400)
  }

  const challenge = challengeById(challengeId)
  if (!challenge) return fail('UNKNOWN_CHALLENGE', 'No such challenge.', 400)

  // Cheap, and saves a browser launch for the commonest mistake there is.
  if (!html.trim()) return fail('EMPTY', 'Write some HTML first.', 400)

  // The gate, and it has to be here rather than only on the map: the client
  // sends a challengeId, so a lock that lives in the UI is a suggestion. Before
  // the render, so a locked submit spends no Chromium.
  //
  // This read is also the `before` snapshot — the unlock crossing has to be
  // measured against the ledger as it was, not inferred from the tiers this
  // submission happens to earn, because tiers are cumulative and one submit can
  // bank three of them.
  const before: TiersByChallenge = (await getPixelProgress(user.id)).tiersByChallenge
  if (!isUnlocked(before, challenge.id)) {
    return fail('CHALLENGE_LOCKED', 'Clear the challenge before this one to unlock it.', 403)
  }

  // Before the render, not before the request: it is the Chromium time being
  // rationed. See rate-limit.ts for why this is load-bearing rather than polite.
  const limit = takeRenderToken(user.id)
  if (!limit.ok) {
    return fail(
      'TOO_MANY_RENDERS',
      `Scoring runs a real browser, so it is rate limited. Try again in ${limit.retryAfter}s.`,
      429,
      { retryAfter: limit.retryAfter },
    )
  }

  let submission: PNG
  let target: Awaited<ReturnType<typeof getTarget>>
  try {
    // The reference first: it is usually cached, and if this challenge is broken
    // we would rather find out before spending a render on the learner's code.
    target = await getTarget(challenge.id)
    submission = PNG.sync.read(await renderToPng({ html, css }, challenge.canvas))
  } catch (err) {
    // The learner sees a category; the function log gets the cause. Without
    // this the production 503 said nothing anywhere about why.
    console.error('[pixel-lab] scoring failed:', err)
    if (err instanceof RenderError) {
      return fail('RENDER_FAILED', 'Could not render your build. Try again in a moment.', 502)
    }
    // An authoring gap, not the learner's problem: say so rather than scoring 0.
    return fail('NO_TARGET', 'This challenge cannot be scored right now.', 503)
  }

  let match: number
  let diffPixels: number
  let unionPixels: number
  try {
    const result = diffImages(
      new Uint8Array(submission.data),
      target.data,
      challenge.canvas.width,
      challenge.canvas.height,
    )
    match = result.match
    diffPixels = result.diffPixels
    unionPixels = result.unionPixels
  } catch (err) {
    if (err instanceof DiffSizeError) {
      // Both sides come out of one renderer at a pinned scale, so this is now a
      // bug in ours rather than anything the learner could cause or fix.
      return fail('SIZE_MISMATCH', 'Something went wrong scoring that. Try again.', 500)
    }
    return fail('DIFF_FAILED', 'Could not compare your build to the target.', 500)
  }

  // Not the raw match: on a 3%-ink navbar an empty editor matches 97% of the
  // target, and used to be paid for it. See score.ts.
  const score = scoreFrom(diffPixels, unionPixels)
  const earned = tiersFor(score)

  // One ledger row per tier: at most three per challenge, forever, and a learner
  // who comes back to improve a scrape into a perfect still gets paid for the
  // difference. Idempotent via the XpEvent unique constraint, so a re-check pays 0.
  let xpGained = 0
  let totalXp = 0
  let level = 0
  let leveledUp = false
  const newBadges: string[] = []
  const freshTiers: Tier[] = []

  for (const tier of earned) {
    const result = await awardXp({
      userId: user.id,
      reason: TIER_REASON[tier],
      sourceId: sourceIdFor(challenge.id, tier),
      amount: xpFor(tier),
      meta: { challengeId: challenge.id, topicId: challenge.topicId, tier, score, match },
    })
    xpGained += result.xpGained
    totalXp = result.totalXp
    level = result.level
    leveledUp = leveledUp || result.leveledUp
    newBadges.push(...result.newBadges)
    if (result.awarded) freshTiers.push(tier)
  }

  // Log the attempt, after the award. The ledger is what matters and must not
  // wait on the log — and `recordSubmission` never throws, so a failed write
  // cannot cost a learner the score they just earned. See lib/pixel/submissions.ts.
  await recordSubmission({
    userId: user.id,
    challengeId: challenge.id,
    html,
    css,
    score,
    match,
    diffPixels,
    unionPixels,
    tiers: earned,
  })

  // What this submission opened. Computed by comparing the ledger to itself
  // before and after rather than guessed from `earned`, so re-scoring an already
  // cleared challenge reports nothing and the map stays quiet.
  const after: TiersByChallenge = { ...before, [challenge.id]: earned }
  const opened = newlyUnlocked(before, after)

  return Response.json({
    /** Of the pixels either side painted, how many are right. The headline. */
    score,
    percent: matchPercent(score),
    /** How much of the whole canvas is identical. Shown beside the score, never as it. */
    match,
    matchPercent: matchPercent(match),
    diffPixels,
    unionPixels,
    totalPixels: challenge.canvas.width * challenge.canvas.height,
    tiers: earned,
    /** Tiers earned for the first time on this submission — the UI celebrates these. */
    freshTiers,
    /** Challenges this submission opened. Drives the map animation and the unlock sound. */
    opened,
    next: nextTierAt(score),
    perfectAt: PERFECT_AT,
    // 0 on a re-check of work already paid for — the ledger is idempotent.
    xpGained,
    totalXp,
    level,
    leveledUp,
    newBadges,
  })
}
