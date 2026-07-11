// Public-safe view of a WON challenge, for the shareable victory card + OG image.
// Never exposes the hidden tests or the reference solution.

import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export interface SharedWin {
  id: string
  name: string
  difficulty: string
  mode: string
  wonXp: number
  winStreak: number
  prompt: string
  createdAt: Date
}

// Deduped per request (page + generateMetadata + opengraph-image all read it).
export const getSharedWin = cache(async (id: string): Promise<SharedWin | null> => {
  const a = await prisma.challengeAttempt.findFirst({
    where: { id, status: 'won' },
    select: {
      id: true, difficulty: true, mode: true, wonXp: true, winStreak: true, prompt: true, createdAt: true,
      user: { select: { name: true } },
    },
  })
  if (!a) return null
  return {
    id: a.id,
    name: a.user?.name ?? 'A learner',
    difficulty: a.difficulty,
    mode: a.mode,
    wonXp: a.wonXp ?? 0,
    winStreak: a.winStreak ?? 1,
    prompt: a.prompt,
    createdAt: a.createdAt,
  }
})
