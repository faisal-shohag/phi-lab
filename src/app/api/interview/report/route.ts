import { GoogleGenAI, Type } from '@google/genai'
import { topicById, levelById, type LevelId } from '@/lib/interview/topics'

// Generates the post-interview report from the full transcript. This uses a
// standard (non-Live) text model so it can return structured JSON via a
// responseSchema — swap REPORT_MODEL to change which model scores the round.

const REPORT_MODEL = 'gemini-3.1-flash-lite'

type Role = 'interviewer' | 'candidate'
interface TurnEntry {
  role: Role
  text: string
}

export interface InterviewReport {
  overallScore: number
  verdict: string
  scores: {
    communication: number
    technicalDepth: number
    accuracy: number
  }
  strengths: string[]
  improvements: string[]
  perQuestion: { question: string; feedback: string; rating: number }[]
  suggestions: string[]
  summary: string
}

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER, description: 'Overall performance 0-100.' },
    verdict: { type: Type.STRING, description: 'Short verdict, e.g. "Strong hire", "Needs practice".' },
    scores: {
      type: Type.OBJECT,
      properties: {
        communication: { type: Type.INTEGER, description: '0-10.' },
        technicalDepth: { type: Type.INTEGER, description: '0-10.' },
        accuracy: { type: Type.INTEGER, description: '0-10.' },
      },
      required: ['communication', 'technicalDepth', 'accuracy'],
      propertyOrdering: ['communication', 'technicalDepth', 'accuracy'],
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    perQuestion: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          feedback: { type: Type.STRING },
          rating: { type: Type.INTEGER, description: '0-10 for this answer.' },
        },
        required: ['question', 'feedback', 'rating'],
        propertyOrdering: ['question', 'feedback', 'rating'],
      },
    },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Concrete study/practice suggestions.' },
    summary: { type: Type.STRING, description: 'One short paragraph summarising the round.' },
  },
  required: ['overallScore', 'verdict', 'scores', 'strengths', 'improvements', 'perQuestion', 'suggestions', 'summary'],
  propertyOrdering: ['overallScore', 'verdict', 'scores', 'strengths', 'improvements', 'perQuestion', 'suggestions', 'summary'],
}

function notEnoughSignal(topicLabel: string): InterviewReport {
  return {
    overallScore: 0,
    verdict: 'Not enough signal',
    scores: { communication: 0, technicalDepth: 0, accuracy: 0 },
    strengths: [],
    improvements: ['The interview ended before you answered enough questions to be scored.'],
    perQuestion: [],
    suggestions: [`Start a new ${topicLabel} round and try to answer at least two full questions out loud.`],
    summary:
      "There wasn't enough of a conversation to assess your skills. Give it another go and speak through your reasoning — even a partial answer gives the interviewer something to score.",
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 })
  }

  let body: { topic?: string; level?: string; transcript?: TurnEntry[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const topicId = body.topic ?? ''
  const level = (body.level ?? 'medium') as LevelId
  const transcript = Array.isArray(body.transcript) ? body.transcript : []

  const topicLabel = topicById(topicId)?.label ?? (topicId || 'the topic')
  const levelLabel = levelById(level)?.label ?? level

  const candidateTurns = transcript.filter((t) => t.role === 'candidate' && t.text.trim().length > 0)
  if (candidateTurns.length < 2) {
    return Response.json(notEnoughSignal(topicLabel))
  }

  const dialogue = transcript
    .map((t) => `${t.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${t.text.trim()}`)
    .join('\n')

  const prompt = [
    `You are grading a short live technical interview about ${topicLabel} at the ${levelLabel} level.`,
    'Below is the full transcript. Score the CANDIDATE only (the interviewer is the AI).',
    'Be fair but honest. Base scores strictly on what the candidate actually said. It was a short 2-minute round, so calibrate expectations accordingly.',
    'For perQuestion, include one entry per distinct question the interviewer asked that the candidate responded to.',
    '',
    'Transcript:',
    dialogue,
  ].join('\n')

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: REPORT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: REPORT_SCHEMA,
      },
    })

    const text = response.text
    if (!text) {
      return Response.json({ error: 'The model returned an empty report.' }, { status: 502 })
    }

    const report = JSON.parse(text) as InterviewReport
    return Response.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Failed to generate report: ${message}` }, { status: 500 })
  }
}
