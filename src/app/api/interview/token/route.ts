import { GoogleGenAI, Modality } from '@google/genai'
import { buildSystemInstruction, type LevelId } from '@/lib/interview/topics'

// Mints a single-use ephemeral token so the browser can open a Gemini Live
// session without ever seeing GEMINI_API_KEY. The token is short-lived: it must
// be used to start a session within a couple of minutes.
//
// Importantly, the full Live config (voice, transcription, and the interviewer
// persona) is LOCKED into the token here via `liveConnectConstraints.config`.
// Connecting from the browser with the config supplied only at connect-time
// fails with a server-side 1011 error for this model, so the browser connects
// with an empty config and everything meaningful is pinned server-side.

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const VOICE = 'Kore'

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 },
    )
  }

  let topic = ''
  let level: LevelId = 'medium'
  try {
    const body = await request.json()
    if (typeof body?.topic === 'string') topic = body.topic
    if (typeof body?.level === 'string') level = body.level as LevelId
  } catch {
    // No body / bad JSON — fall back to defaults so the token still works.
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const now = Date.now()

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // The token itself is valid for 5 minutes...
        expireTime: new Date(now + 5 * 60 * 1000).toISOString(),
        // ...but a new session can only be started within 2 minutes.
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildSystemInstruction(topic, level),
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    return Response.json({ token: token.name })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json(
      { error: `Failed to mint interview token: ${message}` },
      { status: 500 },
    )
  }
}
