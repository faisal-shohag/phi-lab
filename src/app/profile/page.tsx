import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { getProfile } from '@/lib/gamification/award'
import { Achievements } from '@/components/gamification/achievements'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Achievements' }

export default async function ProfilePage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/profile')

  const profile = await getProfile(user.id)

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Achievements</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Your level, XP & badges</p>
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

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Achievements
          initialXp={profile.xp}
          initialBadgeIds={profile.badgeIds}
          stats={profile.stats}
        />
      </main>
    </div>
  )
}
