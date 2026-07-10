import { GoogleGenAI, Modality } from '@google/genai'
import { characterById, CHARACTERS } from '@/lib/interview/topics'
import { buildCoachInstruction } from '@/lib/english/scenarios'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/admin/settings'
import { isSuspended } from '@/lib/admin/suspension'

// Mints a single-use ephemeral Gemini Live token for an English-practice
// session. The AI coach always speaks English (en-US); the learner practises.
//
// Also the enforcement choke point for the admin kill switch, the daily cap,
// and account suspension: no token, no round.

export const LIVE_MODEL = 'gemini-3.1-flash-live-preview'

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return errorResponse('SERVER_ERROR', 'GEMINI_API_KEY is not configured on the server.')

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  if (!(await getSetting('flag.lab.english.enabled'))) return errorResponse('LAB_DISABLED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let scenario = ''
  let characterId = 'nova'
  let resumeSessionId: string | undefined
  let resumeHandle: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.scenario === 'string') scenario = body.scenario
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
      const existing = await prisma.englishSession.findUnique({ where: { id: resumeSessionId } })
      if (!existing || existing.userId !== user.id) return errorResponse('NOT_FOUND')
      if (existing.status !== 'IN_PROGRESS') return errorResponse('NOT_FOUND', 'This session has already ended.')
      sessionId = existing.id
      voiceName = existing.voice
      personaName = CHARACTERS.find((c) => c.voiceName === existing.voice)?.name
      scenario = existing.scenario
    } else {
      const todayCount = await prisma.englishSession.count({
        where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
      })
      if (todayCount >= (await getSetting('lab.english.dailyLimit'))) return errorResponse('DAILY_LIMIT')

      const created = await prisma.englishSession.create({
        data: { userId: user.id, scenario, voice: voiceName, status: 'IN_PROGRESS' },
      })
      sessionId = created.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Could not create practice session: ${message}`)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const now = Date.now()
    // One resolve, used twice: the prompt's pacing and the client's countdown
    // must agree, or the coach wraps up at a different time than the timer.
    const roundSeconds = await getSetting('lab.english.roundSeconds')

    const token = await ai.authTokens.create({
      config: {
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
              languageCode: 'en-US',
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            systemInstruction: buildCoachInstruction(scenario, { personaName, roundSeconds }),
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    return Response.json({ token: token.name, sessionId, roundSeconds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('CONNECT_FAILED', `Failed to mint practice token: ${message}`)
  }
}
