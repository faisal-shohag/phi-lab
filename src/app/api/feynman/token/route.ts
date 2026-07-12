import { Modality } from '@google/genai'
import { characterById, CHARACTERS, languageById, type LanguageId } from '@/lib/interview/topics'
import { buildTeachbackInstruction } from '@/lib/feynman/concepts'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/admin/settings'
import { isSuspended } from '@/lib/admin/suspension'
import { LIVE_MODEL, mintLiveToken } from '@/lib/ai-keys/live-token'
import { keysFor } from '@/lib/ai-keys/pool'
import { END_SESSION_TOOL } from '@/lib/labs/end-session'

// Mints a single-use ephemeral Gemini Live token for a teach-back session. The
// full Live config (voice, language, and the "curious beginner" persona) is
// locked into the token, exactly like the interview lab. The key comes from the
// rotating pool (src/lib/ai-keys/pool.ts).
//
// Also the enforcement choke point for the admin kill switch, the daily cap,
// and account suspension: no token, no round.

export { LIVE_MODEL }

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function POST(request: Request) {
  if (keysFor('gemini').length === 0) {
    return errorResponse('SERVER_ERROR', 'No Gemini API key is configured on the server.')
  }

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  if (!(await getSetting('flag.lab.feynman.enabled'))) return errorResponse('LAB_DISABLED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let concept = ''
  let language: LanguageId = 'en'
  let characterId = 'nova'
  let resumeSessionId: string | undefined
  let resumeHandle: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.concept === 'string') concept = body.concept
    if (typeof body?.language === 'string') language = body.language as LanguageId
    if (typeof body?.characterId === 'string') characterId = body.characterId
    if (typeof body?.resumeSessionId === 'string') resumeSessionId = body.resumeSessionId
    if (typeof body?.resumeHandle === 'string') resumeHandle = body.resumeHandle
  } catch {
    // Bad JSON — fall back to defaults.
  }

  const isResume = Boolean(resumeSessionId)
  let sessionId: string
  let voiceName = characterById(characterId)?.voiceName ?? 'Kore'
  let personaName = characterById(characterId)?.name

  try {
    if (isResume) {
      const existing = await prisma.feynmanSession.findUnique({ where: { id: resumeSessionId } })
      if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')
      if (existing.status !== 'IN_PROGRESS') return errorResponse('NOT_FOUND', 'This session has already ended.')
      sessionId = existing.id
      voiceName = existing.voice
      personaName = CHARACTERS.find((c) => c.voiceName === existing.voice)?.name
      concept = existing.concept
      language = existing.language as LanguageId
    } else {
      const todayCount = await prisma.feynmanSession.count({
        where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
      })
      if (todayCount >= (await getSetting('lab.feynman.dailyLimit'))) return errorResponse('DAILY_LIMIT')

      const created = await prisma.feynmanSession.create({
        data: { userId: user.id, concept, language, voice: voiceName, status: 'IN_PROGRESS' },
      })
      sessionId = created.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Could not create teach-back session: ${message}`)
  }

  try {
    const now = Date.now()
    const speechCode = languageById(language)?.speechCode ?? 'en-US'
    // One resolve, used twice: the prompt's pacing and the client's countdown
    // must agree, or the AI wraps up at a different time than the timer.
    const roundSeconds = await getSetting('lab.feynman.roundSeconds')

    const { token } = await mintLiveToken('FEYNMAN', sessionId, {
      uses: 1,
      // Must outlive the round, plus reconnect headroom.
      expireTime: new Date(now + Math.max(5 * 60, roundSeconds + 120) * 1000).toISOString(),
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
          // Lets the student wrap up when the teacher is done (see prompt).
          tools: [END_SESSION_TOOL],
          sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
          systemInstruction: buildTeachbackInstruction(concept, { language, personaName, roundSeconds }),
        },
      },
      httpOptions: { apiVersion: 'v1alpha' },
    })

    return Response.json({ token, sessionId, roundSeconds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('CONNECT_FAILED', `Failed to mint teach-back token: ${message}`)
  }
}
