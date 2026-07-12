import { Modality } from '@google/genai'
import { characterById } from '@/lib/interview/topics'
import { buildSupportInstruction, supportLanguageById } from '@/lib/support/prompt'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/admin/settings'
import { isSuspended } from '@/lib/admin/suspension'
import { LIVE_MODEL, mintLiveToken } from '@/lib/ai-keys/live-token'
import { keysFor } from '@/lib/ai-keys/pool'
import { END_SESSION_TOOL } from '@/lib/labs/end-session'

// Mints a single-use ephemeral Gemini Live token for a support session — but
// only if the session currently holds one of the active slots and belongs to the
// caller. Context-window compression is enabled because a 10-minute session
// (especially with screen share on) exceeds the uncompressed audio+video window.
// The key comes from the rotating pool (src/lib/ai-keys/pool.ts).
//
// Also the enforcement choke point for the admin kill switch and account
// suspension: no token, no session.

export { LIVE_MODEL }

export async function POST(request: Request) {
  if (keysFor('gemini').length === 0) {
    return errorResponse('SERVER_ERROR', 'No Gemini API key is configured on the server.')
  }

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  if (!(await getSetting('flag.lab.support.enabled'))) return errorResponse('LAB_DISABLED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let sessionId = ''
  let characterId = 'nova'
  let resumeHandle: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.sessionId === 'string') sessionId = body.sessionId
    if (typeof body?.characterId === 'string') characterId = body.characterId
    if (typeof body?.resumeHandle === 'string') resumeHandle = body.resumeHandle
  } catch {
    // Bad JSON — fall through to the not-found guard below.
  }

  const session = await prisma.supportSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== user.id) return errorResponse('NOT_FOUND')
  if (session.status !== 'active') {
    return errorResponse('NOT_FOUND', 'This session is not active yet. Please wait for your turn.')
  }

  const voiceName = characterById(characterId)?.voiceName ?? session.voice ?? 'Kore'
  const speechCode = supportLanguageById(session.language)?.speechCode ?? 'en-US'

  // Persist the chosen voice so a resume mint uses the same one.
  if (session.voice !== voiceName) {
    await prisma.supportSession.update({ where: { id: sessionId }, data: { voice: voiceName } }).catch(() => {})
  }

  try {
    const now = Date.now()
    // One resolve, used three times: the token's lifetime, the prompt's pacing,
    // and the client's countdown must all agree.
    const roundSeconds = await getSetting('lab.support.roundSeconds')

    const { token } = await mintLiveToken('SUPPORT', sessionId, {
      uses: 1,
      // Cover the full session plus reconnect headroom.
      expireTime: new Date(now + (roundSeconds + 120) * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            languageCode: speechCode,
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // Lets the supporter hang up when the learner is done (see prompt).
          tools: [END_SESSION_TOOL],
          // Required for a 10-min session and for audio+video (screen share).
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
          systemInstruction: buildSupportInstruction(
            session.category,
            session.problem,
            session.language,
            roundSeconds,
          ),
        },
      },
      httpOptions: { apiVersion: 'v1alpha' },
    })

    return Response.json({ token, roundSeconds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('CONNECT_FAILED', `Failed to mint support token: ${message}`)
  }
}
