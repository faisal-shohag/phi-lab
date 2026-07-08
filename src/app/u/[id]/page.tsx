import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getProfile } from '@/lib/gamification/award'
import { getProfileInfo } from '@/lib/profile/info'
import { levelInfo } from '@/lib/gamification/levels'
import { ProfileHero } from '@/components/profile/profile-hero'
import { CareerCard } from '@/components/profile/career-card'
import { BadgeShowcase } from '@/components/profile/badge-showcase'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

// Fetch a user only when their profile is public. Never selects email.
async function loadPublicUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true, createdAt: true, profilePublic: true, headline: true },
  })
  if (!user || !user.profilePublic) return null
  return user
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const user = await loadPublicUser(id)
  if (!user) return { title: 'Profile' }
  const desc = user.headline || `${user.name}'s learning profile on Phi Lab — level, badges and skills.`
  return {
    title: `${user.name} — Phi Lab profile`,
    description: desc,
    openGraph: { title: `${user.name} — Phi Lab profile`, description: desc },
  }
}

export default async function PublicProfilePage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await loadPublicUser(id)
  if (!user) notFound()

  const [profile, info] = await Promise.all([getProfile(user.id), getProfileInfo(user.id)])
  const level = levelInfo(profile.xp)

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-sm font-bold">Phi Lab</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <AnimatedThemeToggler />
            <Button asChild size="sm">
              <Link href="/">Start learning</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <ProfileHero
          name={user.name}
          image={user.image}
          createdAt={user.createdAt}
          level={level.level}
          title={level.title}
          info={info}
        />

        <CareerCard info={info} />

        <BadgeShowcase badgeIds={profile.badgeIds} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PublicStat label="Total XP" value={profile.xp} />
          <PublicStat label="Interviews" value={profile.stats.interviewsCompleted} />
          <PublicStat label="Teach-backs" value={profile.stats.feynmanCompleted} />
          <PublicStat label="Analogies" value={profile.stats.analogiesCreated} />
        </div>

        <div className="rounded-2xl border-2 border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Want a profile like this?</p>
          <Button asChild className="mt-2 bg-linear-to-r from-amber-500 via-fuchsia-500 to-violet-600">
            <Link href="/">Start learning on Phi Lab</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}

function PublicStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 text-center shadow-sm">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
