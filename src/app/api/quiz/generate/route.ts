import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/admin/settings'
import { isSuspended } from '@/lib/admin/suspension'
import { generateStructured } from '@/lib/hive/providers'
import { QUIZ_TOPIC_IDS, type QuizQuestion } from '@/lib/quiz/topics'
import { QUIZ_SCHEMA } from '@/lib/quiz/schema'

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced'])
const VALID_COUNTS = new Set([5, 10, 15, 20])

interface GenerateBody {
  topics: string[]
  difficulty: string
  count: number
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  if (!(await getSetting('flag.lab.quiz.enabled'))) return errorResponse('LAB_DISABLED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let body: GenerateBody
  try {
    const raw = await request.json()
    const topics = Array.isArray(raw?.topics)
      ? raw.topics.filter((t: unknown): t is string => typeof t === 'string' && QUIZ_TOPIC_IDS.includes(t as typeof QUIZ_TOPIC_IDS[number]))
      : []
    const difficulty = typeof raw?.difficulty === 'string' && VALID_DIFFICULTIES.has(raw.difficulty) ? raw.difficulty : 'beginner'
    const count = typeof raw?.count === 'number' && VALID_COUNTS.has(raw.count) ? raw.count : 10
    if (topics.length === 0) return errorResponse('SERVER_ERROR', 'Select at least one topic.')
    body = { topics, difficulty, count }
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }

  const todayCount = await prisma.quizSession.count({
    where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
  })
  if (todayCount >= (await getSetting('lab.quiz.dailyLimit'))) return errorResponse('DAILY_LIMIT')

  const topicLabels = body.topics.join(', ')
  const prompt = [
    `Generate a ${body.difficulty} multiple-choice quiz about: ${topicLabels}.`,
    '',
    `Requirements:`,
    `- Generate exactly ${body.count} questions`,
    `- Each question must have exactly 4 options with one correct answer`,
    `- Questions should test practical knowledge, not obscure trivia`,
    `- Explanations should teach the concept, not just state the answer`,
    `- For Beginner: focus on syntax, definitions, and basic usage`,
    `- For Intermediate: focus on patterns, best practices, and common pitfalls`,
    `- For Advanced: focus on internals, edge cases, performance, and architecture`,
    `- Mix questions across all selected topics evenly`,
    `- Avoid ambiguous questions or "all of the above" / "none of the above"`,
    `- Each question should be self-contained`,
    `- The "topic" field must exactly match one of: ${topicLabels}`,
  ].join('\n')

  let raw: { questions: unknown[] }
  try {
    raw = await generateStructured<{ questions: unknown[] }>(prompt, QUIZ_SCHEMA, {
      feature: 'QUIZ',
      task: 'GENERATE_QUIZ',
      userId: user.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Failed to generate quiz: ${message}`)
  }

  const questions: QuizQuestion[] = []
  for (const q of raw.questions) {
    if (
      typeof q === 'object' && q !== null &&
      'question' in q && typeof (q as { question: unknown }).question === 'string' &&
      'options' in q && Array.isArray((q as { options: unknown }).options) &&
      (q as { options: unknown[] }).options.length === 4 &&
      'correctIndex' in q && typeof (q as { correctIndex: unknown }).correctIndex === 'number' &&
      (q as { correctIndex: number }).correctIndex >= 0 && (q as { correctIndex: number }).correctIndex <= 3 &&
      'explanation' in q && typeof (q as { explanation: unknown }).explanation === 'string' &&
      'topic' in q && typeof (q as { topic: unknown }).topic === 'string'
    ) {
      questions.push({
        question: (q as { question: string }).question,
        options: (q as { options: string[] }).options as QuizQuestion['options'],
        correctIndex: (q as { correctIndex: number }).correctIndex,
        explanation: (q as { explanation: string }).explanation,
        topic: (q as { topic: string }).topic,
      })
    }
  }

  if (questions.length === 0) {
    return errorResponse('SERVER_ERROR', 'AI returned no valid questions. Please try again.')
  }

  const saved = await prisma.quizSession.create({
    data: {
      userId: user.id,
      topics: body.topics,
      difficulty: body.difficulty,
      questionCount: body.count,
      questions: questions as unknown as object,
      total: questions.length,
    },
  })

  const clientQuestions = questions.map((q) => ({
    question: q.question,
    options: q.options,
    topic: q.topic,
  }))

  return Response.json({
    id: saved.id,
    topics: saved.topics,
    difficulty: saved.difficulty,
    questionCount: saved.questionCount,
    questions: clientQuestions,
    total: saved.total,
    status: saved.status,
    createdAt: saved.createdAt.toISOString(),
  })
}
