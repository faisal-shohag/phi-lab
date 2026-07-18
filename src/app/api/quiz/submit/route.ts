import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { isSuspended } from '@/lib/admin/suspension'
import type { QuizQuestion } from '@/lib/quiz/topics'

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let sessionId: string
  let answers: number[]
  try {
    const body = await request.json()
    if (typeof body?.sessionId !== 'string') return errorResponse('SERVER_ERROR', 'Missing sessionId.')
    if (!Array.isArray(body?.answers)) return errorResponse('SERVER_ERROR', 'Missing answers.')
    sessionId = body.sessionId
    answers = body.answers.filter((a: unknown): a is number => typeof a === 'number')
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }

  const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
  if (!session) return errorResponse('NOT_FOUND')
  if (session.userId !== user.id) return errorResponse('AUTH_REQUIRED')
  if (session.status !== 'in_progress') return errorResponse('SERVER_ERROR', 'Quiz already submitted.')

  const questions = session.questions as unknown as QuizQuestion[]
  const correctAnswers = questions.map((q) => q.correctIndex)

  let score = 0
  for (let i = 0; i < correctAnswers.length; i++) {
    if (answers[i] === correctAnswers[i]) score++
  }

  const total = questions.length
  const percentage = total > 0 ? score / total : 0
  let xpAmount = score * 10
  if (percentage >= 1) xpAmount += 20
  else if (percentage >= 0.8) xpAmount += 10

  const updated = await prisma.quizSession.update({
    where: { id: sessionId },
    data: {
      answers: answers as unknown as object,
      score,
      status: 'completed',
      xpAwarded: xpAmount,
    },
  })

  let xpResult
  try {
    xpResult = await awardXp({
      userId: user.id,
      reason: 'quiz_completed',
      sourceId: sessionId,
      amount: xpAmount,
      meta: { score, total, percentage, difficulty: session.difficulty, topics: session.topics },
    })
  } catch {
    // XP is best-effort
  }

  return Response.json({
    id: updated.id,
    score: updated.score,
    total: updated.total,
    xpAwarded: updated.xpAwarded,
    questions,
    answers,
    status: updated.status,
    xp: xpResult,
  })
}
