import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { getProfile } from '@/lib/gamification/award'
import { levelInfo } from '@/lib/gamification/levels'
import { BADGES } from '@/lib/gamification/badges'
import { getProfileInfo } from '@/lib/profile/info'
import { initials } from '@/lib/profile/format'
import type { ProfileCardData } from '@/lib/profile/draw-profile-card'
import { Achievements } from '@/components/gamification/achievements'
import { ProfileHero } from '@/components/profile/profile-hero'
import { ProfileCompletion } from '@/components/profile/profile-completion'
import { CareerCard } from '@/components/profile/career-card'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/profile')

  const [profile, info, dbUser] = await Promise.all([
    getProfile(user.id),
    getProfileInfo(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
  ])

  const level = levelInfo(profile.xp)
  const earned = new Set(profile.badgeIds)
  const badgeCount = BADGES.filter((b) => earned.has(b.id)).length
  const createdAt = dbUser?.createdAt ?? new Date()

  const card: ProfileCardData = {
    name: user.name || 'Learner',
    headline: info.headline,
    initials: initials(user.name, user.email),
    level: level.level,
    title: level.title,
    xp: profile.xp,
    badgeCount,
    url: `/u/${user.id}`,
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Profile</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Your level, XP, badges & career</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
            <AnimatedThemeToggler />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <ProfileHero
          name={user.name || 'Learner'}
          email={user.email}
          image={user.image}
          createdAt={createdAt}
          level={level.level}
          title={level.title}
          info={info}
          owner={{ path: `/u/${user.id}`, card }}
        />

        <ProfileCompletion info={info} />

        <CareerCard info={info} isOwner />

        <Achievements
          initialXp={profile.xp}
          initialBadgeIds={profile.badgeIds}
          stats={profile.stats}
        />
      </main>
    </div>
  )
}
