import { GoogleGenAI, Type } from '@google/genai'
import { languageById, type LanguageId } from '@/lib/interview/topics'
import { conceptById } from '@/lib/feynman/concepts'
import type { FeynmanReport } from '@/lib/feynman/report-types'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { feynmanXp } from '@/lib/gamification/reasons'
import { recordAiUsage } from '@/lib/ai-usage/record'
import { normalizeTokens } from '@/lib/ai-usage/tokens'

// Grades a teach-back session: how well did the learner *explain* the concept to
// a beginner? Uses a standard text model so it can return structured JSON.

const REPORT_MODEL = 'gemini-3.1-flash-lite'

type Role = 'student' | 'teacher'
interface TurnEntry {
  role: Role
  text: string
}

export type { FeynmanReport }

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clarityScore: { type: Type.INTEGER, description: 'Would a real beginner understand this explanation? 0-100.' },
    verdict: { type: Type.STRING, description: 'Short verdict, e.g. "Crystal clear", "Needs simpler words".' },
    scores: {
      type: Type.OBJECT,
      properties: {
        clarity: { type: Type.INTEGER, description: '0-10: how understandable.' },
        completeness: { type: Type.INTEGER, description: '0-10: how much of the concept was covered.' },
        correctness: { type: Type.INTEGER, description: '0-10: how accurate.' },
      },
      required: ['clarity', 'completeness', 'correctness'],
      propertyOrdering: ['clarity', 'completeness', 'correctness'],
    },
    nailed: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'What the teacher explained well.' },
    revisit: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'What to revisit next time.' },
    jargon: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Technical terms used without explaining them.' },
    misconceptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Statements that were inaccurate.' },
    gaps: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Important parts of the concept that were skipped.' },
    analogyQuality: { type: Type.STRING, description: 'Short note on how concrete/effective the analogies were.' },
    juniorLearned: { type: Type.STRING, description: 'What a beginner would end up understanding from this explanation (the mirror test).' },
    summary: { type: Type.STRING, description: 'One short paragraph summarising the teach-back.' },
  },
  required: ['clarityScore', 'verdict', 'scores', 'nailed', 'revisit', 'jargon', 'misconceptions', 'gaps', 'analogyQuality', 'juniorLearned', 'summary'],
  propertyOrdering: ['clarityScore', 'verdict', 'scores', 'nailed', 'revisit', 'jargon', 'misconceptions', 'gaps', 'analogyQuality', 'juniorLearned', 'summary'],
}

function notEnoughSignal(conceptLabel: string): FeynmanReport {
  return {
    clarityScore: 0,
    verdict: 'Not enough signal',
    scores: { clarity: 0, completeness: 0, correctness: 0 },
    nailed: [],
    revisit: [`Explain ${conceptLabel} out loud for at least a minute so we can grade your teaching.`],
    jargon: [],
    misconceptions: [],
    gaps: [],
    analogyQuality: '—',
    juniorLearned: "Not much — the lesson ended before there was enough to learn from.",
    summary:
      "There wasn't enough of an explanation to assess. Start a new round and teach the idea out loud as if to a curious beginner — even a rough explanation gives us something to score.",
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return errorResponse('SERVER_ERROR', 'GEMINI_API_KEY is not configured on the server.')

  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let sessionId = ''
  try {
    const body = await request.json()
    if (typeof body?.sessionId === 'string') sessionId = body.sessionId
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }
  if (!sessionId) return errorResponse('NOT_FOUND', 'No teach-back session was provided.')

  const session = await prisma.feynmanSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== user.id) return errorResponse('NOT_FOUND')

  // Idempotent: if we already scored this session, just return it.
  if (session.status === 'COMPLETED' && session.report) {
    return Response.json(session.report as unknown as FeynmanReport)
  }

  const conceptId = session.concept
  const language = session.language as LanguageId
  const transcript = (Array.isArray(session.transcript) ? session.transcript : []) as unknown as TurnEntry[]

  const conceptLabel = conceptById(conceptId)?.label ?? (conceptId || 'the concept')

  const teacherTurns = transcript.filter((t) => t?.role === 'teacher' && t?.text?.trim().length > 0)
  if (teacherTurns.length < 2) {
    const report = notEnoughSignal(conceptLabel)
    await prisma.feynmanSession.update({
      where: { id: sessionId },
      data: { report: report as unknown as object, clarityScore: 0, status: 'COMPLETED', endedAt: session.endedAt ?? new Date() },
    })
    return Response.json(report)
  }

  const dialogue = transcript
    .map((t) => `${t.role === 'student' ? 'Student (AI)' : 'Teacher (candidate)'}: ${t.text.trim()}`)
    .join('\n')

  const prompt = [
    `A learner is teaching the concept of "${conceptLabel}" out loud to a curious beginner (the AI student). Grade only the TEACHER's explanation — how well would a real beginner understand it?`,
    'Below is the full transcript. Judge clarity, completeness and correctness. Reward plain language, concrete examples and good analogies; penalise unexplained jargon, gaps and inaccuracies.',
    'It was a short ~3-minute session, so calibrate expectations accordingly. Base everything strictly on what the teacher actually said.',
    'For juniorLearned, write what a beginner would genuinely take away from this explanation — if the teaching was unclear or wrong, reflect that honestly (this is the mirror test).',
    language === 'bn'
      ? 'Write EVERY string in the report (verdict, nailed, revisit, jargon, misconceptions, gaps, analogyQuality, juniorLearned, summary) in Bengali (Bangla). Technical terms may stay in English.'
      : '',
    '',
    'Transcript:',
    dialogue,
  ]
    .filter(Boolean)
    .join('\n')

  // Telemetry context shared by the success and failure paths below.
  const startedAt = Date.now()
  const usageBase = {
    feature: 'FEYNMAN',
    task: 'REPORT',
    provider: 'GEMINI',
    model: REPORT_MODEL,
    tryIndex: 1,
    sessionId,
    userId: user.id,
  } as const

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: REPORT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: REPORT_SCHEMA },
    })

    const text = response.text
    if (!text) {
      void recordAiUsage({
        ...usageBase,
        success: false,
        latencyMs: Date.now() - startedAt,
        tokens: normalizeTokens(response.usageMetadata),
        errorKind: 'TRUNCATED',
        errorMessage: 'the model returned an empty report',
      })
      await prisma.feynmanSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } })
      return errorResponse('REPORT_FAILED', 'The model returned an empty report.')
    }

    // Recorded only once the payload actually parses — a malformed body is an
    // INVALID_JSON failure, and it falls to the catch below.
    const report = JSON.parse(text) as FeynmanReport

    void recordAiUsage({
      ...usageBase,
      success: true,
      latencyMs: Date.now() - startedAt,
      tokens: normalizeTokens(response.usageMetadata),
    })

    await prisma.feynmanSession.update({
      where: { id: sessionId },
      data: {
        report: report as unknown as object,
        clarityScore: report.clarityScore,
        status: 'COMPLETED',
        endedAt: session.endedAt ?? new Date(),
      },
    })

    // Award XP once per completed teach-back (idempotent on sessionId).
    try {
      await awardXp({
        userId: user.id,
        reason: 'feynman_completed',
        sourceId: sessionId,
        amount: feynmanXp(report.clarityScore),
        meta: { clarity: report.clarityScore, concept: conceptId },
      })
    } catch {
      // ignore — XP is best-effort
    }

    return Response.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    void recordAiUsage({
      ...usageBase,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorKind: err instanceof SyntaxError ? 'INVALID_JSON' : 'UNKNOWN',
      errorMessage: message,
    })
    await prisma.feynmanSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } }).catch(() => {})
    return errorResponse('REPORT_FAILED', `Failed to generate report: ${message}`)
  }
}
