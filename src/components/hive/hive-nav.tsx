'use client'

// Hive section top bar: brand, primary links (Feed, Honeycomb, and Mentor for
// mentors/admins) and the notification bell.
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { NotificationBell } from './notification-bell'

export function HiveNav({ role }: { role: 'STUDENT' | 'MENTOR' | 'ADMIN' }) {
  const pathname = usePathname()
  const isMentor = role === 'MENTOR' || role === 'ADMIN'

  const links = [
    { href: '/hive', label: 'Feed', exact: true },
    { href: '/hive/honeycomb', label: 'Honeycomb' },
    ...(isMentor ? [{ href: '/hive/mentor', label: 'Mentor' }] : []),
  ]

  function active(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <header className="hive-glass-nav sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:gap-4">
        <Link href="/hive" className="flex shrink-0 items-center gap-2">
          <Image
            src="/hive/honeycomb.png"
            alt=""
            aria-hidden
            width={64}
            height={64}
            priority
            className="size-7 select-none drop-shadow-sm"
          />
          <span className="bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-amber-300 dark:to-orange-400">
            Hive
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 transition sm:px-3',
                active(l.href, l.exact)
                  ? 'bg-primary/15 font-medium text-primary shadow-inner'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              {l.label === 'Mentor' && <ShieldCheck className="size-3.5" />}
              {l.label}
            </Link>
          ))}
        </nav>
        {/* Same controls as the landing header, so moving between the site and
            the Hive never changes where your account lives. */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <NotificationBell />
          <AnimatedThemeToggler />
          <XpBadge />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
