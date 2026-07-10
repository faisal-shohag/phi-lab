// Mentor-only: the escalated queue, longest-waiting first, each row carrying
// the AI's full attempt log so the mentor never repeats what the AI already
// tried. Starting warm is the whole point of the escalation handoff.
import { requireMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { error } = await requireMentor()
  if (error) return hiveError(error)

  const posts = await prisma.hivePost.findMany({
    where: { status: 'ESCALATED' },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      assignedMentor: { select: { id: true, name: true } },
      replies: {
        where: { authorType: 'AI' },
        orderBy: { aiAttempt: 'asc' },
        select: { id: true, aiAttempt: true, body: true, kind: true },
      },
      events: {
        where: { type: 'escalated' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { meta: true, createdAt: true },
      },
    },
  })

  return Response.json({
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      tags: p.tags,
      topic: p.topic,
      severity: p.severity,
      sensitive: p.sensitive,
      author: { id: p.author?.id ?? null, name: p.author?.name ?? 'Unknown', image: p.author?.image ?? null },
      assignedMentor: p.assignedMentor,
      aiAttempts: p.replies.map((r) => ({
        id: r.id,
        attempt: r.aiAttempt,
        kind: r.kind,
        body: r.body,
      })),
      escalationReason:
        (p.events[0]?.meta as { reason?: string } | null)?.reason ?? 'escalated',
      escalatedAt: (p.events[0]?.createdAt ?? p.createdAt).toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  })
}
