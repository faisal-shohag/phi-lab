import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import type { AnalogyCardData, AnalogyLanguage } from '@/lib/analogies/concepts'
import { AnalogiesLab } from '@/components/analogies/analogies-lab'

export default async function AnalogiesLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/analogies')

  const rows = await prisma.analogyCard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const deck: AnalogyCardData[] = rows.map((r) => ({
    id: r.id,
    concept: r.concept,
    language: r.language as AnalogyLanguage,
    title: r.title,
    scene: r.scene,
    mapping: r.mapping as unknown as AnalogyCardData['mapping'],
    soBasically: r.soBasically,
    techNote: r.techNote,
    emoji: r.emoji,
  }))

  return <AnalogiesLab initialDeck={deck} />
}
