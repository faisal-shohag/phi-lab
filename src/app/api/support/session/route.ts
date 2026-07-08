import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { supportCategoryById, supportLanguageById } from '@/lib/support/prompt'
import { claimSlots } from '@/lib/support/queue'

// Creates a support session. The learner writes their problem first; the row
// starts in the queue (status 'waiting') and is promoted to 'active' when one of
// the 3 platform-wide slots is free. A daily cap keeps the tiny pool usable.

const DAILY_LIMIT = 3

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let category = ''
  let problem = ''
  let language = 'en'
  try {
    const body = await request.json()
    if (typeof body?.category === 'string') category = body.category
    if (typeof body?.problem === 'string') problem = body.problem
    if (typeof body?.language === 'string') language = body.language
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }

  if (!supportCategoryById(category)) return errorResponse('SERVER_ERROR', 'Please choose a valid category.')
  if (!supportLanguageById(language)) language = 'en'
  problem = problem.trim()
  if (problem.length < 10) return errorResponse('SERVER_ERROR', 'Please describe your problem in a little more detail.')
  problem = problem.slice(0, 2000)

  try {
    const todayCount = await prisma.supportSession.count({
      where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
    })
    if (todayCount >= DAILY_LIMIT) return errorResponse('DAILY_LIMIT', "You've used all your support sessions for today. Come back tomorrow.")

    const created = await prisma.supportSession.create({
      data: { userId: user.id, category, problem, language, status: 'waiting' },
    })

    // Try to claim a slot immediately so a free platform gets connected at once.
    const { status, position } = await claimSlots(created.id)

    return Response.json({ sessionId: created.id, status, position })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Could not join the support queue: ${message}`)
  }
}
