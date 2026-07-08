import { GoogleGenAI, Modality, Type } from '@google/genai'
import { characterById } from '@/lib/interview/topics'
import { buildSupportInstruction, supportLanguageById, SUPPORT_SECONDS } from '@/lib/support/prompt'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

// Mints a single-use ephemeral Gemini Live token for a support session — but
// only if the session currently holds one of the active slots and belongs to the
// caller. Context-window compression is enabled because a 10-minute session
// (especially with screen share on) exceeds the uncompressed audio+video window.

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return errorResponse('SERVER_ERROR', 'GEMINI_API_KEY is not configured on the server.')

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

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
    const ai = new GoogleGenAI({ apiKey })
    const now = Date.now()

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // Cover the full 10-minute session plus reconnect headroom.
        expireTime: new Date(now + (SUPPORT_SECONDS + 120) * 1000).toISOString(),
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
            tools: [{
              functionDeclarations: [{
                name: 'end_session',
                description: 'End the support call. Call this only after the learner has confirmed they are done and you have said a brief goodbye.',
                parameters: { type: Type.OBJECT, properties: {} },
              }],
            }],
            // Required for a 10-min session and for audio+video (screen share).
            contextWindowCompression: { slidingWindow: {} },
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            systemInstruction: buildSupportInstruction(session.category, session.problem, session.language),
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    return Response.json({ token: token.name, roundSeconds: SUPPORT_SECONDS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('CONNECT_FAILED', `Failed to mint support token: ${message}`)
  }
}
