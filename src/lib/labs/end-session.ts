// Letting a live round end when the conversation is actually over.
//
// A round has always been able to end on the clock. What it could not do — in
// three of the four labs — is end because the learner said "I'm done, thanks",
// or because the material genuinely ran out early. The interviewer would keep
// asking questions into a goodbye. This gives every lab the same `end_session`
// tool the support lab already had, and one shared set of rules for using it.
//
// The pieces here have to agree across four labs that are forks of one another
// (four token routes, four prompt builders, four hooks), so they live in one
// place rather than four.
import { Type } from '@google/genai'
import { spokenDuration } from './duration'

/**
 * The tool the model calls to hang up. The full Live config is locked into the
 * ephemeral token — connecting from the browser with a config fails with a 1011
 * for this model — so this goes in the token routes, not the client.
 */
export const END_SESSION_TOOL = {
  functionDeclarations: [
    {
      name: 'end_session',
      description:
        'End the session and hang up. Call this only after the learner has confirmed they are done and you have said a brief goodbye.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
  ],
}

/**
 * How long a round must have run before the model is allowed to end it.
 *
 * A model that misreads an early pause as "we're finished" would otherwise hang
 * up forty seconds into a three-minute interview, and the learner would lose the
 * round. So the client refuses an `end_session` before this point and tells the
 * model to keep going.
 *
 * 40% of the round, capped at a minute. The cap is what matters for the long
 * support call: a ten-minute session whose problem is genuinely solved after two
 * minutes should be free to close, and a flat 40% (four minutes) would trap the
 * learner in it. The fraction is what matters for a short round, where a flat
 * minute could be most of the session.
 */
export function minElapsedSeconds(roundSeconds: number): number {
  return Math.min(60, Math.round(roundSeconds * 0.4))
}

/** What the client sends back when it refuses an end_session. */
export const TOO_EARLY_RESPONSE = {
  ok: false,
  reason: 'It is too early to end the session. Keep going — do not say goodbye yet.',
}

export const END_OK_RESPONSE = { ok: true }

/** Which lab a session belongs to. Matches the AiFeature values the API expects. */
export type LiveFeature = 'INTERVIEW' | 'FEYNMAN' | 'ENGLISH' | 'SUPPORT'

/**
 * Tell the server the learner walked away, on the way out of the page.
 *
 * A round that never reaches a report never reaches a terminal status either, so
 * without this the row is stranded at IN_PROGRESS. `sendBeacon` is the only thing
 * that reliably survives an unload; it carries cookies (so the endpoint can still
 * authenticate the caller) but cannot set headers, which is why the endpoint reads
 * a plain JSON body.
 *
 * Safe to call whenever a live round is torn down: the endpoint only moves a
 * session that is still running, so a beacon that races a finished report loses.
 */
export function beaconAbandon(feature: LiveFeature, sessionId: string | null): void {
  if (!sessionId || typeof navigator === 'undefined') return
  try {
    navigator.sendBeacon(
      '/api/labs/abandon',
      new Blob([JSON.stringify({ feature, sessionId })], { type: 'application/json' }),
    )
  } catch {
    // Best effort by definition — the cron sweep is the backstop.
  }
}

/** Playback below this is silence, not a gap between chunks. */
const SILENT_SECONDS = 0.05
/** The queue must stay empty this long before we believe the goodbye is over. */
const QUIET_MS = 500
/** A model that says nothing must not strand the learner on a dead screen. */
const FAREWELL_CAP_MS = 10_000

/**
 * Wait for the model's farewell to actually finish playing.
 *
 * The naive version of this is a fixed timeout after the tool call, which is a
 * guess about something we can just measure — and the guess is wrong in both
 * directions. Too short and the socket closes mid-goodbye; too long and the
 * learner stares at a finished conversation.
 *
 * Audio arrives in chunks, so a single empty read of the queue is a gap between
 * words, not the end of the sentence. Only a sustained silence means the model
 * has stopped talking. The cap is the backstop for a model that calls the tool
 * without speaking at all.
 */
export async function waitForFarewell(
  pendingSeconds: () => number,
  { capMs = FAREWELL_CAP_MS, quietMs = QUIET_MS }: { capMs?: number; quietMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + capMs
  let quietSince: number | null = null

  while (Date.now() < deadline) {
    if (pendingSeconds() > SILENT_SECONDS) {
      quietSince = null // still speaking
    } else {
      quietSince ??= Date.now()
      if (Date.now() - quietSince >= quietMs) return
    }
    await new Promise((r) => setTimeout(r, 100))
  }
}

/**
 * The paragraph every lab's system instruction ends with.
 *
 * Two conditions, one procedure. The conditions are deliberately narrow — the
 * failure we care about is a model that hangs up on a learner who still wants to
 * talk, which is far worse than one that runs a little long. The procedure exists
 * because the goodbye has to be SPOKEN before the tool call: the client waits for
 * the farewell audio to finish playing and then closes the socket, so a tool call
 * that arrives with nothing said just ends the round in silence.
 */
export function endingInstruction(roundSeconds: number): string {
  return [
    `Ending the session: the session runs about ${spokenDuration(roundSeconds)}, but it does not have to use all of it.`,
    'End it early when either is clearly true: the learner signals they are done (they say they want to stop, or that they have what they needed), or the purpose of the session is genuinely complete.',
    'When that happens: check gently first ("Are you all set?"), then say a warm one-sentence goodbye OUT LOUD, and only THEN call the end_session tool.',
    'Never call end_session while the learner still wants to keep going, and never call it before you have said goodbye — the call hangs up the moment you call it.',
  ].join(' ')
}
