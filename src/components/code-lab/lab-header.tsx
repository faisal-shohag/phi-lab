import Link from 'next/link'
import { ArrowLeft, Code2 } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

// The shared Code Lab top bar (logo + title + XP + avatar), so the problem list
// and every contest page wear the same chrome. The workspace keeps its own
// toolbar because it also holds Run/Submit.
export function LabHeader({
  subtitle = 'Solve JS & TS problems, graded on the server',
  backHref = '/',
  backLabel = 'Home',
}: {
  subtitle?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
        <Logo className="h-8 w-8" />
        <div>
          <h1 className="flex items-center gap-1.5 text-sm font-bold leading-tight">
            <Code2 className="h-4 w-4" /> Code Lab
          </h1>
          <p className="text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          </Button>
          <XpBadge />
          <AnimatedThemeToggler />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
