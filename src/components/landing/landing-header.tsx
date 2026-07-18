'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Menu, Route } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

// In-page anchors plus real routes. `route: true` marks a full navigation
// (Path, Hive) rather than a same-page scroll.
const NAV_LINKS = [
  { href: '/path', label: 'Path', route: true },
  { href: '#labs', label: 'Labs' },
  { href: '#journey', label: 'How it works' },
  { href: '#features', label: 'Features' },
]

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </a>
  )
}

function HiveLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/hive"
      onClick={onClick}
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
  )
}

export function LandingHeader() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-9 w-9" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Phi Lab</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Programming Hero Instructor Lab</p>
          </div>
        </Link>

        <nav className="ml-6 hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
          <HiveLink />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <AnimatedThemeToggler />
          <Button
            asChild
            size="sm"
            className="hidden bg-linear-to-r from-fuchsia-500 to-pink-500 text-white shadow-sm shadow-pink-500/20 hover:from-fuchsia-500 hover:to-pink-400 sm:inline-flex"
          >
            <Link href="/path">
              <Route className="size-4" /> Start the Path
            </Link>
          </Button>
          <XpBadge />
          <UserMenu />

          {/* Mobile nav disclosure */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-0 p-0">
              <SheetTitle className="border-b px-5 py-4 text-left">
                <span className="flex items-center gap-2">
                  <Logo className="h-7 w-7" />
                  <span className="text-sm font-bold">Phi Lab</span>
                </span>
              </SheetTitle>
              <nav className="flex flex-col gap-1 p-3">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/hive"
                  onClick={close}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Image src="/hive/honeycomb.png" alt="" aria-hidden width={40} height={40} className="size-4" />
                  Hive
                </Link>
              </nav>
              <div className="mt-auto border-t p-3">
                <Button
                  asChild
                  className="w-full bg-linear-to-r from-fuchsia-500 to-pink-500 text-white hover:from-fuchsia-500 hover:to-pink-400"
                >
                  <Link href="/path" onClick={close}>
                    <Route className="size-4" /> Start the Path
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
