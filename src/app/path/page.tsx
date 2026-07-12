import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { getPathSnapshot } from '@/lib/path/snapshot'
import { MODULES } from '@/lib/path/curriculum'
import { PathView } from '@/components/path/path-view'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'The Path',
  description: 'Your guided, AI-personalized journey from first console.log to job-ready.',
}

export default async function PathPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/path')

  const snapshot = await getPathSnapshot(user.id)

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">The Path</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Your journey to job-ready</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
            <AnimatedThemeToggler />
            <XpBadge />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <PathView initial={snapshot} modules={MODULES} userName={user.name || 'Learner'} />
      </main>
    </div>
  )
}
