// Minting an ephemeral Gemini Live token, on a rotated key.
//
// All four voice labs (interview, feynman, english, support) mint through here.
// Two things this buys over `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`:
//
//  1. Rotation + retry. The pool hands out the next key in the live lane, and a
//     key that is rate limited or rejected is parked and the mint retried on the
//     next one. Previously a single 429 on the one key killed the round outright.
//
//  2. Attribution. A live round runs browser <-> Google directly — the server
//     never sees the socket, and the token usage is reported back afterwards by
//     the browser, which deliberately is NOT told which key it is on (it would be
//     free to lie, and poison another key's stats). So the key is recorded here,
//     against the session, and /api/ai-usage/live joins on it.
//
// The token itself is what reaches the browser. The key never does.
import { GoogleGenAI, type CreateAuthTokenConfig } from '@google/genai'
import { prisma } from '@/lib/prisma'
import { withKey } from './pool'
import type { AiFeature } from '@/generated/prisma/client'

/** The Live model every lab connects to. One definition, four labs. */
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview'

export interface MintedToken {
  /** The ephemeral token name, safe to hand to the browser. */
  token: string
  /** Which key minted it, by env var name. Server-side bookkeeping only. */
  keyId: string
}

/**
 * Mint a single-use Live token and record which key it came from.
 *
 * `config` is passed to the SDK untouched — the full Live config (voice,
 * transcription, persona, resumption) has to be LOCKED INTO the token, because
 * connecting from the browser with the config at connect-time fails with a
 * server-side 1011 for this model.
 *
 * Throws `AllKeysFailed` when every Gemini key is spent; callers surface that as
 * CONNECT_FAILED, same as any other mint failure.
 */
export async function mintLiveToken(
  feature: AiFeature,
  sessionId: string,
  config: CreateAuthTokenConfig,
): Promise<MintedToken> {
  const { result, keyId } = await withKey('gemini', 'live', async (key) => {
    const ai = new GoogleGenAI({ apiKey: key.value })
    return ai.authTokens.create({ config })
  })

  // A resume re-mints for the same session, possibly on a different key, and the
  // usage report lands once at the end — so the last key to serve the session is
  // the one that owns the bulk of it. Last write wins, deliberately.
  //
  // Best-effort: losing the attribution row costs one unattributed usage row on
  // the dashboard. Failing the mint over it would cost the student their round.
  await prisma.liveTokenIssue
    .upsert({
      where: { sessionId },
      create: { sessionId, feature, keyId, model: LIVE_MODEL },
      update: { keyId, model: LIVE_MODEL },
    })
    .catch(() => {})

  return { token: result.name ?? '', keyId }
}
