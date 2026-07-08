// Server-only profile reads. Imports Prisma, so DO NOT import this from a client
// component — use ./shared for the pure helpers/types instead. Re-exports the
// shared surface so existing server-side imports keep working.
import { prisma } from '@/lib/prisma'
import { EMPTY_PROFILE, type ProfileInfo } from './shared'

export * from './shared'

const SELECT = {
  headline: true,
  bio: true,
  goal: true,
  skills: true,
  location: true,
  resumeUrl: true,
  githubUrl: true,
  linkedinUrl: true,
  websiteUrl: true,
  profilePublic: true,
} as const

/** Read a learner's career/profile info. Returns EMPTY_PROFILE if not found. */
export async function getProfileInfo(userId: string): Promise<ProfileInfo> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SELECT })
  if (!row) return EMPTY_PROFILE
  return {
    headline: row.headline,
    bio: row.bio,
    goal: row.goal,
    skills: row.skills ?? [],
    location: row.location,
    resumeUrl: row.resumeUrl,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    websiteUrl: row.websiteUrl,
    profilePublic: row.profilePublic,
  }
}
