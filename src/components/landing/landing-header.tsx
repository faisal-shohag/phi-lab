'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'

// In-page anchors, plus Hive which is a real route rather than a section.
const NAV_LINKS = [
  { href: '#labs', label: 'Labs' },
  { href: '#journey', label: 'Journey' },
  { href: '#features', label: 'Features' },
]

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-9 w-9" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Phi Lab</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Programming Hero Instructor Lab</p>
          </div>
        </Link>

        <nav className="ml-6 hidden items-center gap-5 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/hive"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Image
              src="/hive/honeycomb.png"
              alt=""
              aria-hidden
              width={40}
              height={40}
              className="size-4 select-none transition-transform group-hover:scale-110"
            />
            Hive
          </Link>
          <Link
            href="/brain"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Brain className="size-4 transition-transform group-hover:scale-110" />
            Brain
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <AnimatedThemeToggler />
          <Button asChild size="sm" className="hidden sm:inline-flex bg-linear-to-r from-red-500 to-pink-500">
            <a href="#labs">Open a lab</a>
          </Button>
          <XpBadge />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
