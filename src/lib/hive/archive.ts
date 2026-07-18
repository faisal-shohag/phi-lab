// Archiving a resolved post into the Honeycomb knowledge base.
//
// This is what makes the 7-day TTL safe: the only threads that survive are the
// ones with an accepted answer, and they survive as a distilled entry rather
// than a raw transcript. Runs in `after()` — the student never waits on it.
import { prisma } from '@/lib/prisma'
import { summarizeForKb } from './ai'
import { invalidatePost } from './detail'
import { invalidateFeed, invalidateHoneycomb } from './cache'

export async function archiveToHoneycomb(postId: string): Promise<void> {
  const post = await prisma.hivePost.findUnique({
    where: { id: postId },
    select: { id: true, title: true, body: true, status: true, acceptedReplyId: true, kbSummary: true },
  })
  if (!post || post.status !== 'RESOLVED' || !post.acceptedReplyId || post.kbSummary) return

  const accepted = await prisma.hiveReply.findUnique({
    where: { id: post.acceptedReplyId },
    select: { body: true },
  })
  if (!accepted) return

  let kbSummary: string
  try {
    const kb = await summarizeForKb(post, accepted.body, { postId })
    const takeaways = kb.keyTakeaways.map((t) => `- ${t}`).join('\n')
    kbSummary = `## ${kb.kbTitle}\n\n${kb.kbSummary}\n\n**Key takeaways**\n${takeaways}`
  } catch {
    // Fall back to the accepted answer itself: an entry without an AI summary is
    // still worth keeping. Better a plain archive than a lost one.
    kbSummary = accepted.body
  }

  await prisma.hivePost.update({
    where: { id: postId },
    data: { kbSummary, status: 'ARCHIVED', archivedAt: new Date() },
  })
  await prisma.hivePostEvent.create({ data: { postId, type: 'archived' } })
  invalidatePost(postId)
  invalidateFeed()
  invalidateHoneycomb()
}
