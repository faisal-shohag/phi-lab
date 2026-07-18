import { Type } from '@google/genai'
import { topicById, levelById, type LevelId, type LanguageId } from '@/lib/interview/topics'
import type { InterviewReport } from '@/lib/interview/report-types'
import { subtopicsForTopic } from '@/lib/interview/questions'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { interviewXp } from '@/lib/gamification/reasons'
import { generateStructured } from '@/lib/hive/providers'

// Generates the post-interview report from the transcript stored server-side.
// Uses a standard (non-Live) text model so it can return structured JSON via a
// responseSchema. The report is persisted on the session row; re-calling this
// route with the same sessionId is how the "Try again" retry works.
//
// Grading goes through the shared failover engine (src/lib/hive/providers.ts),
// so it rotates across every Gemini key and falls back to Ollama/Groq rather
// than losing a student's report to one 429. The engine owns the model choice
// and writes the AiUsageEvent rows — including the failed attempts.

type Role = 'interviewer' | 'candidate'
interface TurnEntry {
  role: Role
  text: string
}

export type { InterviewReport }

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
    subtopicCoverage: {
      type: Type.ARRAY,
      description: 'Rate each sub-topic from the list below. Mark covered=true if the candidate was asked about it. Rate 0-10 based on answer quality.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'The subtopic ID.' },
          label: { type: Type.STRING, description: 'Human-readable label.' },
          covered: { type: Type.BOOLEAN },
          rating: { type: Type.INTEGER, description: '0-10 if covered, else 0.' },
        },
        required: ['id', 'label', 'covered', 'rating'],
        propertyOrdering: ['id', 'label', 'covered', 'rating'],
      },
    },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Concrete study/practice suggestions.' },
    summary: { type: Type.STRING, description: 'One short paragraph summarising the round.' },
  },
  required: ['overallScore', 'verdict', 'scores', 'strengths', 'improvements', 'perQuestion', 'subtopicCoverage', 'suggestions', 'summary'],
  propertyOrdering: ['overallScore', 'verdict', 'scores', 'strengths', 'improvements', 'perQuestion', 'subtopicCoverage', 'suggestions', 'summary'],
}

function notEnoughSignal(topicLabel: string, topicId: string): InterviewReport {
  const subtopics = subtopicsForTopic(topicId)
  return {
    overallScore: 0,
    verdict: 'Not enough signal',
    scores: { communication: 0, technicalDepth: 0, accuracy: 0 },
    strengths: [],
    improvements: ['The interview ended before you answered enough questions to be scored.'],
    perQuestion: [],
    subtopicCoverage: (subtopics?.subtopics ?? []).map((s) => ({ id: s.id, label: s.label, covered: false, rating: 0 })),
    suggestions: [`Start a new ${topicLabel} round and try to answer at least two full questions out loud.`],
    summary:
      "There wasn't enough of a conversation to assess your skills. Give it another go and speak through your reasoning — even a partial answer gives the interviewer something to score.",
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let sessionId = ''
  try {
    const body = await request.json()
    if (typeof body?.sessionId === 'string') sessionId = body.sessionId
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }
  if (!sessionId) return errorResponse('NOT_FOUND', 'No interview session was provided.')

  const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== user.id) return errorResponse('NOT_FOUND')

  // Idempotent: if we already scored this session, just return it.
  if (session.status === 'COMPLETED' && session.report) {
    return Response.json(session.report as unknown as InterviewReport)
  }

  const topicId = session.topic
  const level = session.level as LevelId
  const language = session.language as LanguageId
  const transcript = (Array.isArray(session.transcript) ? session.transcript : []) as unknown as TurnEntry[]

  const topicLabel = topicById(topicId)?.label ?? (topicId || 'the topic')
  const levelLabel = levelById(level)?.label ?? level

  const candidateTurns = transcript.filter((t) => t?.role === 'candidate' && t?.text?.trim().length > 0)
  if (candidateTurns.length < 2) {
    const report = notEnoughSignal(topicLabel, topicId)
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { report: report as unknown as object, overallScore: 0, status: 'COMPLETED', endedAt: session.endedAt ?? new Date() },
    })
    return Response.json(report)
  }

  const subtopicEntry = subtopicsForTopic(topicId)
  const subtopicList = subtopicEntry
    ? subtopicEntry.subtopics.map((s) => `- ${s.id}: ${s.label}`).join('\n')
    : ''

  const dialogue = transcript
    .map((t) => `${t.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${t.text.trim()}`)
    .join('\n')

  const prompt = [
    `You are grading a short live technical interview about ${topicLabel} at the ${levelLabel} level.`,
    'Below is the full transcript. Score the CANDIDATE only (the interviewer is the AI).',
    'Be fair but honest. Base scores strictly on what the candidate actually said. It was a short 3-minute round, so calibrate expectations accordingly.',
    'For perQuestion, include one entry per distinct question the interviewer asked that the candidate responded to.',
    subtopicList
      ? [
          '',
          'Sub-topics for this topic (evaluate coverage of each):',
          subtopicList,
          '',
          'For subtopicCoverage: for each sub-topic above, set covered=true if the interviewer asked about that area and the candidate responded. Rate the candidate 0-10 for that sub-topic. Set covered=false and rating=0 if it was not touched.',
        ].join('\n')
      : '',
    language === 'bn'
      ? 'Write EVERY string in the report (verdict, strengths, improvements, feedback, suggestions, summary, subtopic labels) in Bengali (Bangla). Technical terms may stay in English.'
      : '',
    '',
    'Transcript:',
    dialogue,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    // The engine records the usage row per attempt, empty/malformed replies
    // included, and fails over to the next key or provider on its own.
    const report = await generateStructured<InterviewReport>(prompt, REPORT_SCHEMA, {
      feature: 'INTERVIEW',
      task: 'REPORT',
      sessionId,
      userId: user.id,
    })

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        report: report as unknown as object,
        overallScore: report.overallScore,
        status: 'COMPLETED',
        endedAt: session.endedAt ?? new Date(),
      },
    })

    // Award XP once per completed interview (idempotent on sessionId). Never let
    // a gamification hiccup break the report response.
    try {
      await awardXp({
        userId: user.id,
        reason: 'interview_completed',
        sourceId: sessionId,
        amount: interviewXp(report.overallScore, session.pressure),
        meta: { score: report.overallScore, topic: topicId, pressure: session.pressure },
      })
    } catch {
      // ignore — XP is best-effort
    }

    return Response.json(report)
  } catch (err) {
    // Every key and provider failed, or the reply wouldn't parse. The session is
    // marked FAILED, which is what lets the UI offer "Try again" — a retry gets a
    // fresh candidate chain, and by then a parked key may well have freed up.
    const message = err instanceof Error ? err.message : 'Unknown error'
    await prisma.interviewSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } }).catch(() => {})
    return errorResponse('REPORT_FAILED', `Failed to generate report: ${message}`)
  }
}
