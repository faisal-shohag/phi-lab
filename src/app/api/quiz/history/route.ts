import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
  const skip = (page - 1) * limit

  const [sessions, total] = await Promise.all([
    prisma.quizSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        topics: true,
        difficulty: true,
        questionCount: true,
        score: true,
        total: true,
        xpAwarded: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.quizSession.count({ where: { userId: user.id } }),
  ])

  const stats = await prisma.quizSession.aggregate({
    where: { userId: user.id, status: 'completed' },
    _avg: { score: true },
    _sum: { xpAwarded: true },
    _count: true,
  })

  return Response.json({
    sessions: sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    stats: {
      totalQuizzes: stats._count,
      averageScore: stats._avg.score,
      totalXpEarned: stats._sum.xpAwarded ?? 0,
    },
  })
}
