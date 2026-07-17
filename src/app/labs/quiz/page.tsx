import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import type { QuizSessionData } from '@/lib/quiz/topics'
import { QuizLab } from '@/components/quiz/quiz-lab'

export default async function QuizLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/quiz')

  const rows = await prisma.quizSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      topics: true,
      difficulty: true,
      questionCount: true,
      questions: true,
      answers: true,
      score: true,
      total: true,
      xpAwarded: true,
      status: true,
      createdAt: true,
    },
  })

  const history: QuizSessionData[] = rows.map((r) => ({
    id: r.id,
    topics: r.topics,
    difficulty: r.difficulty,
    questionCount: r.questionCount,
    questions: r.questions as QuizSessionData['questions'],
    answers: (r.answers as number[] | null) ?? null,
    score: r.score,
    total: r.total,
    xpAwarded: r.xpAwarded,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }))

  return <QuizLab initialHistory={history} />
}
