// Background verification of peer answers. Runs in `after()` so the student who
// answered never waits on the model.
//
// Only APPROVED earns the Bee-Approved mark and its XP. `unsure` and `reject`
// silently leave the answer plain — the student is never publicly corrected by
// a machine, and a wrong answer never wears a verified badge.
import { prisma } from '@/lib/prisma'
import { verifyPeerAnswer } from './ai'
import { awardXp } from '@/lib/gamification/award'
import { hiveApprovedXp } from '@/lib/gamification/reasons'
import { notifyUser } from './notify'

export async function runPeerVerification(replyId: string): Promise<void> {
  const reply = await prisma.hiveReply.findUnique({
    where: { id: replyId },
    include: { post: { select: { id: true, title: true, body: true } } },
  })
  if (!reply || reply.authorType !== 'STUDENT' || reply.kind !== 'ANSWER') return
  if (reply.verification !== 'NONE' && reply.verification !== 'PENDING') return

  await prisma.hiveReply.update({ where: { id: replyId }, data: { verification: 'PENDING' } })

  let verdict: 'approve' | 'reject' | 'unsure'
  let note: string
  try {
    const result = await verifyPeerAnswer(reply.post, reply.body, {
      postId: reply.post.id,
      userId: reply.authorId ?? undefined,
    })
    verdict = result.verdict
    note = result.note
  } catch {
    // Verification is a bonus, not a gate: leave the answer unmarked.
    await prisma.hiveReply.update({ where: { id: replyId }, data: { verification: 'NONE' } })
    return
  }

  const verification = verdict === 'approve' ? 'APPROVED' : verdict === 'reject' ? 'REJECTED' : 'NONE'
  await prisma.hiveReply.update({
    where: { id: replyId },
    data: { verification, verifyNote: note },
  })

  if (verification !== 'APPROVED' || !reply.authorId) return

  await prisma.hivePostEvent.create({
    data: { postId: reply.post.id, type: 'bee_approved', meta: { replyId, note } },
  })

  try {
    await awardXp({
      userId: reply.authorId,
      reason: 'hive_answer_approved',
      sourceId: replyId,
      amount: hiveApprovedXp(),
      meta: { postId: reply.post.id },
    })
  } catch {
    // XP is best-effort
  }

  await notifyUser({
    userId: reply.authorId,
    postId: reply.post.id,
    type: 'bee_approved',
    title: 'Your answer was Bee-Approved 🐝',
    body: reply.post.title,
  })
}
