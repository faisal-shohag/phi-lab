import { GoogleGenAI, Type } from '@google/genai'
import { scenarioById } from '@/lib/english/scenarios'
import type { EnglishReport } from '@/lib/english/report-types'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { englishXp } from '@/lib/gamification/reasons'

// Grades the learner's spoken technical English from a practice transcript.

const REPORT_MODEL = 'gemini-3.1-flash-lite'

type Role = 'coach' | 'learner'
interface TurnEntry {
  role: Role
  text: string
}

export type { EnglishReport }

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER, description: 'Overall spoken-English readiness 0-100.' },
    verdict: { type: Type.STRING, description: 'Short verdict, e.g. "Confident and clear", "Understandable, needs polish".' },
    scores: {
      type: Type.OBJECT,
      properties: {
        fluency: { type: Type.INTEGER, description: '0-10: smoothness and flow.' },
        clarity: { type: Type.INTEGER, description: '0-10: how easy to understand.' },
        confidence: { type: Type.INTEGER, description: '0-10: assertive, professional tone.' },
      },
      required: ['fluency', 'clarity', 'confidence'],
      propertyOrdering: ['fluency', 'clarity', 'confidence'],
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    grammarFixes: {
      type: Type.ARRAY,
      description: 'Concrete corrections of things the learner actually said.',
      items: {
        type: Type.OBJECT,
        properties: {
          said: { type: Type.STRING, description: 'Roughly what the learner said (their words).' },
          better: { type: Type.STRING, description: 'A more natural or correct way to say it.' },
        },
        required: ['said', 'better'],
        propertyOrdering: ['said', 'better'],
      },
    },
    vocabBoost: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Stronger word/phrase choices to learn.' },
    fillerNote: { type: Type.STRING, description: 'Short note on filler words / hedging, or "—" if not notable.' },
    summary: { type: Type.STRING, description: 'One short paragraph summarising the practice.' },
  },
  required: ['overallScore', 'verdict', 'scores', 'strengths', 'improvements', 'grammarFixes', 'vocabBoost', 'fillerNote', 'summary'],
  propertyOrdering: ['overallScore', 'verdict', 'scores', 'strengths', 'improvements', 'grammarFixes', 'vocabBoost', 'fillerNote', 'summary'],
}

function notEnoughSignal(scenarioLabel: string): EnglishReport {
  return {
    overallScore: 0,
    verdict: 'Not enough signal',
    scores: { fluency: 0, clarity: 0, confidence: 0 },
    strengths: [],
    improvements: [`Speak more during the ${scenarioLabel} so we can assess your English.`],
    grammarFixes: [],
    vocabBoost: [],
    fillerNote: '—',
    summary:
      "There wasn't enough speech to assess. Start a new round and talk through it out loud — even a few full sentences give us something to score.",
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
  if (!sessionId) return errorResponse('NOT_FOUND', 'No practice session was provided.')

  const session = await prisma.englishSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== user.id) return errorResponse('NOT_FOUND')

  if (session.status === 'COMPLETED' && session.report) {
    return Response.json(session.report as unknown as EnglishReport)
  }

  const scenarioId = session.scenario
  const transcript = (Array.isArray(session.transcript) ? session.transcript : []) as unknown as TurnEntry[]
  const scenarioLabel = scenarioById(scenarioId)?.label ?? (scenarioId || 'the scenario')

  const learnerTurns = transcript.filter((t) => t?.role === 'learner' && t?.text?.trim().length > 0)
  if (learnerTurns.length < 2) {
    const report = notEnoughSignal(scenarioLabel)
    await prisma.englishSession.update({
      where: { id: sessionId },
      data: { report: report as unknown as object, overallScore: 0, status: 'COMPLETED', endedAt: session.endedAt ?? new Date() },
    })
    return Response.json(report)
  }

  const dialogue = transcript
    .map((t) => `${t.role === 'coach' ? 'Coach (AI)' : 'Learner'}: ${t.text.trim()}`)
    .join('\n')

  const prompt = [
    `A software developer is practising spoken technical English in a "${scenarioLabel}" roleplay with an AI coach. Grade ONLY the LEARNER's spoken English — not the technical correctness of what they said.`,
    'Assess fluency (flow), clarity (easy to understand, well organised) and confidence (assertive, professional tone).',
    'For grammarFixes, quote roughly what the learner actually said and give a more natural/correct version — pick the most useful 3-6 fixes. For vocabBoost, suggest stronger words or phrases they could have used.',
    'Be encouraging and specific. It was a short ~3-minute conversation, so calibrate accordingly. Base everything strictly on what the learner actually said.',
    '',
    'Transcript:',
    dialogue,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: REPORT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: REPORT_SCHEMA },
    })

    const text = response.text
    if (!text) {
      await prisma.englishSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } })
      return errorResponse('REPORT_FAILED', 'The model returned an empty report.')
    }

    const report = JSON.parse(text) as EnglishReport
    await prisma.englishSession.update({
      where: { id: sessionId },
      data: {
        report: report as unknown as object,
        overallScore: report.overallScore,
        status: 'COMPLETED',
        endedAt: session.endedAt ?? new Date(),
      },
    })

    try {
      await awardXp({
        userId: user.id,
        reason: 'english_completed',
        sourceId: sessionId,
        amount: englishXp(report.overallScore),
        meta: { score: report.overallScore, scenario: scenarioId },
      })
    } catch {
      // ignore — XP is best-effort
    }

    return Response.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await prisma.englishSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } }).catch(() => {})
    return errorResponse('REPORT_FAILED', `Failed to generate report: ${message}`)
  }
}
