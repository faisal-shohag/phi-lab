// Server-only. The learner's PathProfile: destination + pace, plus the two flags
// that gate onboarding. Thin wrapper over Prisma so the snapshot and the
// /path/start flow read and write it the same way.

import { prisma } from '@/lib/prisma'
import type { PathGoal } from './goals'

export interface PathProfileView {
  goal: PathGoal
  weeklyHours: number
  onboarded: boolean
  placed: boolean
}

/** The learner's profile, or null if they have never onboarded. */
export async function getProfile(userId: string): Promise<PathProfileView | null> {
  const row = await prisma.pathProfile.findUnique({ where: { userId } })
  if (!row) return null
  return {
    goal: row.goal as PathGoal,
    weeklyHours: row.weeklyHours,
    onboarded: !!row.onboardedAt,
    placed: !!row.placedAt,
  }
}

/** Answers from the three onboarding questions. Marks the profile onboarded. */
export async function saveOnboarding(userId: string, goal: PathGoal, weeklyHours: number): Promise<void> {
  const hours = Math.min(40, Math.max(1, Math.round(weeklyHours)))
  await prisma.pathProfile.upsert({
    where: { userId },
    create: { userId, goal, weeklyHours: hours, onboardedAt: new Date() },
    update: { goal, weeklyHours: hours, onboardedAt: new Date() },
  })
}

/** Change destination or pace after onboarding. Route + ETA recompute on next read. */
export async function updateProfile(userId: string, patch: { goal?: PathGoal; weeklyHours?: number }): Promise<void> {
  const data: { goal?: PathGoal; weeklyHours?: number } = {}
  if (patch.goal) data.goal = patch.goal
  if (patch.weeklyHours != null) data.weeklyHours = Math.min(40, Math.max(1, Math.round(patch.weeklyHours)))
  await prisma.pathProfile.update({ where: { userId }, data })
}

/** Record that the placement gauntlet has run (idempotent-ish; just stamps the time). */
export async function markPlaced(userId: string): Promise<void> {
  await prisma.pathProfile.update({ where: { userId }, data: { placedAt: new Date() } })
}
