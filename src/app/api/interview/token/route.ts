import { GoogleGenAI, Modality } from '@google/genai'
import {
  buildSystemInstruction,
  characterById,
  CHARACTERS,
  languageById,
  ROUND_SECONDS,
  type LanguageId,
  type LevelId,
} from '@/lib/interview/topics'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

// Mints a single-use ephemeral token so the browser can open a Gemini Live
// session without ever seeing GEMINI_API_KEY. The full Live config (voice,
// language, transcription, persona, and session resumption) is LOCKED into the
// token via `liveConnectConstraints.config` — connecting from the browser with
// the config at connect-time fails with a server-side 1011 for this model.

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const DAILY_LIMIT = 10

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return errorResponse('SERVER_ERROR', 'GEMINI_API_KEY is not configured on the server.')
  }

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let topic = ''
  let level: LevelId = 'medium'
  let language: LanguageId = 'en'
  let characterId = 'nova'
  let resumeSessionId: string | undefined
  let resumeHandle: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.topic === 'string') topic = body.topic
    if (typeof body?.level === 'string') level = body.level as LevelId
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
      language = existing.language as LanguageId
    } else {
      // Fresh start — enforce the daily cap, decide the intro, create the row.
      const todayCount = await prisma.interviewSession.count({
        where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
      })
      if (todayCount >= DAILY_LIMIT) return errorResponse('DAILY_LIMIT')

      const totalCount = await prisma.interviewSession.count({ where: { userId: user.id } })
      includeIntro = totalCount === 0 || Math.random() < 0.28

      const created = await prisma.interviewSession.create({
        data: { userId: user.id, topic, level, language, voice: voiceName, includeIntro, status: 'IN_PROGRESS' },
      })
      sessionId = created.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Could not create interview session: ${message}`)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const now = Date.now()
    const speechCode = languageById(language)?.speechCode ?? 'en-US'

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 5 * 60 * 1000).toISOString(),
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
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            systemInstruction: buildSystemInstruction(topic, level, { language, includeIntro, personaName }),
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    return Response.json({ token: token.name, sessionId, roundSeconds: ROUND_SECONDS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('CONNECT_FAILED', `Failed to mint interview token: ${message}`)
  }
}
