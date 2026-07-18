// Route-level fallback for /path. Because it exists, Next partial-prefetches the
// route on <Link> hover/viewport and shows this instantly on client navigation
// instead of a blank frame. Mirrors the page chrome + the static map scaffold so
// the arrival is seamless.

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MODULES } from '@/lib/path/curriculum'
import { PathScaffold } from '@/components/path/path-scaffold'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export default function Loading() {
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
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <PathScaffold modules={MODULES} />
      </main>
    </div>
  )
}
