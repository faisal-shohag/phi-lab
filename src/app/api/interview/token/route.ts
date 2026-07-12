import { Modality } from '@google/genai'
import {
  buildSystemInstruction,
  characterById,
  CHARACTERS,
  languageById,
  type LanguageId,
  type LevelId,
  type PressureId,
} from '@/lib/interview/topics'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/admin/settings'
import { isSuspended } from '@/lib/admin/suspension'
import { LIVE_MODEL, mintLiveToken } from '@/lib/ai-keys/live-token'
import { keysFor } from '@/lib/ai-keys/pool'
import { END_SESSION_TOOL } from '@/lib/labs/end-session'

// Mints a single-use ephemeral token so the browser can open a Gemini Live
// session without ever seeing a Gemini API key. The full Live config (voice,
// language, transcription, persona, and session resumption) is LOCKED into the
// token via `liveConnectConstraints.config` — connecting from the browser with
// the config at connect-time fails with a server-side 1011 for this model.
//
// The key is drawn from the rotating pool (src/lib/ai-keys/pool.ts), so a round
// survives one key being rate limited, and the dashboard can tell you which key
// paid for it.
//
// This is also the enforcement choke point for the admin kill switch, the daily
// cap, and account suspension: no token, no round.

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

  if (!(await getSetting('flag.lab.interview.enabled'))) return errorResponse('LAB_DISABLED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let topic = ''
  let level: LevelId = 'medium'
  let pressure: PressureId = 'neutral'
  let language: LanguageId = 'en'
  let characterId = 'nova'
  let resumeSessionId: string | undefined
  let resumeHandle: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.topic === 'string') topic = body.topic
    if (typeof body?.level === 'string') level = body.level as LevelId
    if (typeof body?.pressure === 'string') pressure = body.pressure as PressureId
    if (typeof body?.language === 'string') language = body.language as LanguageId
    if (typeof body?.characterId === 'string') characterId = body.characterId
    if (typeof body?.resumeSessionId === 'string') resumeSessionId = body.resumeSessionId
    if (typeof body?.resumeHandle === 'string') resumeHandle = body.resumeHandle
  } catch {
    // Bad JSON — fall back to defaults.
  }

  const isResume = Boolean(resumeSessionId)
  let sessionId: string
  let includeIntro = false
  let voiceName = characterById(characterId)?.voiceName ?? 'Kore'
  let personaName = characterById(characterId)?.name

  try {
    if (isResume) {
      // Resuming a dropped round — reuse the stored session's settings.
      const existing = await prisma.interviewSession.findUnique({ where: { id: resumeSessionId } })
      if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')
      if (existing.status !== 'IN_PROGRESS') return errorResponse('NOT_FOUND', 'This interview has already ended.')
      sessionId = existing.id
      includeIntro = existing.includeIntro
      voiceName = existing.voice
      personaName = CHARACTERS.find((c) => c.voiceName === existing.voice)?.name
      topic = existing.topic
      level = existing.level as LevelId
      pressure = existing.pressure as PressureId
      language = existing.language as LanguageId
    } else {
      // Fresh start — enforce the daily cap, decide the intro, create the row.
      const todayCount = await prisma.interviewSession.count({
        where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
      })
      if (todayCount >= (await getSetting('lab.interview.dailyLimit'))) return errorResponse('DAILY_LIMIT')

      const totalCount = await prisma.interviewSession.count({ where: { userId: user.id } })
      includeIntro = totalCount === 0 || Math.random() < 0.28

      const created = await prisma.interviewSession.create({
        data: { userId: user.id, topic, level, pressure, language, voice: voiceName, includeIntro, status: 'IN_PROGRESS' },
      })
      sessionId = created.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Could not create interview session: ${message}`)
  }

  try {
    const now = Date.now()
    const speechCode = languageById(language)?.speechCode ?? 'en-US'
    // One resolve, used twice: the prompt's pacing and the client's countdown
    // must agree, or the interviewer wraps up at a different time than the timer.
    const roundSeconds = await getSetting('lab.interview.roundSeconds')

    const { token } = await mintLiveToken('INTERVIEW', sessionId, {
      uses: 1,
      // Must outlive the round itself, plus reconnect headroom — a token that
      // expires mid-round kills the session. Scales with the admin setting.
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
          // Lets the interviewer wrap up when the candidate is done (see prompt).
          tools: [END_SESSION_TOOL],
          sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
          systemInstruction: buildSystemInstruction(topic, level, {
            language,
            includeIntro,
            personaName,
            pressure,
            roundSeconds,
          }),
        },
      },
      httpOptions: { apiVersion: 'v1alpha' },
    })

    return Response.json({ token, sessionId, roundSeconds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('CONNECT_FAILED', `Failed to mint interview token: ${message}`)
  }
}
