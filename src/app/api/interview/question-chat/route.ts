import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { keysFor } from '@/lib/ai-keys/pool'

const CHAT_MODEL = 'gemini-3.1-flash-lite'

// Strip non-printable characters, zero-width spaces, and potential inline data markers
// that Gemini rejects as "image input".
function sanitizeText(s: string): string {
  return s
    // Remove control characters (except newline/tab) and zero-width chars
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    // Collapse excessive whitespace
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function sanitizeHistory(history: unknown): { role: string; content: string }[] {
  if (!Array.isArray(history)) return []
  return history
    .filter(
      (m): m is { role: string; content: string } =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as Record<string, unknown>).role === 'string' &&
        typeof (m as Record<string, unknown>).content === 'string',
    )
    .slice(-20) // keep last 20 messages max
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', content: sanitizeText(m.content) }))
}

// Simple chat endpoint for follow-up questions about interview questions.
// Uses the Gemini API directly with the shared key pool.

export async function POST(request: Request) {
  if (keysFor('gemini').length === 0) {
    return errorResponse('SERVER_ERROR', 'No Gemini API key is configured.')
  }

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let question = ''
  let answer = ''
  let topic = ''
  let subtopic = ''
  let message = ''
  let rawHistory: unknown = []

  try {
    const body = await request.json()
    if (typeof body?.question === 'string') question = body.question
    if (typeof body?.answer === 'string') answer = body.answer
    if (typeof body?.topic === 'string') topic = body.topic
    if (typeof body?.subtopic === 'string') subtopic = body.subtopic
    if (typeof body?.message === 'string') message = body.message
    rawHistory = body?.history
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid request body.')
  }

  // Sanitize all text inputs
  question = sanitizeText(question)
  answer = sanitizeText(answer)
  topic = sanitizeText(topic)
  subtopic = sanitizeText(subtopic)
  message = sanitizeText(message)
  const history = sanitizeHistory(rawHistory)

  if (!question || !answer || !message) {
    return errorResponse('SERVER_ERROR', 'Missing required fields: question, answer, and message.')
  }

  const keys = keysFor('gemini')
  if (keys.length === 0) return errorResponse('SERVER_ERROR', 'No Gemini API key available.')

  const key = keys[0]

  const systemPrompt = `You are a helpful technical interview tutor. A student is studying an interview question and wants to understand it better.

Context:
- Topic: ${topic}
- Subtopic: ${subtopic}
- Question: ${question}
- Model Answer: ${answer}

Rules:
- Be concise and clear (2-4 paragraphs max).
- Use simple language, avoid jargon when possible.
- If the student asks for examples, provide concrete code or real-world scenarios.
- If the student asks for clarification, re-explain the concept in simpler terms.
- You can go beyond the model answer to provide deeper insights.
- Never reveal that you are an AI — just be a helpful tutor.
- Respond ONLY with plain text. Do not include any images, code blocks with special formatting, or non-text content.`

  const contents: { role: string; parts: { text: string }[] }[] = []

  // Add conversation history
  for (const msg of history) {
    contents.push({
      role: msg.role,
      parts: [{ text: msg.content }],
    })
  }

  // Add the current message
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': key.value,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: 'text/plain',
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      },
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      console.error('Gemini chat error:', res.status, errText)
      return errorResponse('SERVER_ERROR', 'Failed to generate a response from the AI.')
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return errorResponse('SERVER_ERROR', 'The AI returned an empty response.')
    }

    // Some models return error-like text instead of an HTTP error
    const errPatterns = ['cannot read', 'does not support image', 'clipboard', 'inline data']
    const lowerText = text.toLowerCase()
    if (errPatterns.some((p) => lowerText.includes(p))) {
      console.error('Gemini returned error-like text:', text.slice(0, 200))
      return Response.json({ reply: 'Sorry, something went wrong with that request. Please try rephrasing your question.' })
    }

    return Response.json({ reply: sanitizeText(text) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Chat failed: ${msg}`)
  }
}
