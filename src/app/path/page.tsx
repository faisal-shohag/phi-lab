import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { getPathSnapshot } from '@/lib/path/snapshot'
import { getProfile } from '@/lib/path/profile'
import { MODULES } from '@/lib/path/curriculum'
import { PathView } from '@/components/path/path-view'
import { PathScaffold } from '@/components/path/path-scaffold'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'The Path',
  description: 'Your guided, AI-personalized journey from first console.log to job-ready.',
}

// The heavy part — getPathSnapshot runs syncPath (banks nodes, awards XP), the
// daily quest, and reads the AI weekly report. Isolated in its own async
// component so it streams behind a <Suspense> boundary: the header + the map
// scaffold (module titles/nodes, pure MODULES data) paint immediately, and the
// per-user progress overlay fills in a beat later instead of blocking the whole
// route. This is the static-shell/stream split that also positions the route for
// `unstable_instant` once Cache Components is enabled repo-wide.
async function PathData({ userId, userName }: { userId: string; userName: string }) {
  const snapshot = await getPathSnapshot(userId)
  return <PathView initial={snapshot} modules={MODULES} userName={userName} />
}

export default async function PathPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/path')

  // First-ever visit (no onboarding yet) → the placement/onboarding flow. That's
  // where goal + pace get set; without them the route and ETA have no anchor.
  const profile = await getProfile(user.id)
  if (!profile?.onboarded) redirect('/path/start')

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
        <Suspense fallback={<PathScaffold modules={MODULES} />}>
          <PathData userId={user.id} userName={user.name || 'Learner'} />
        </Suspense>
      </main>
    </div>
  )
}
