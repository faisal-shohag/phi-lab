'use client'

import Link from 'next/link'
import { Route, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-lg sm:p-14">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/15 via-fuchsia-500/15 to-violet-600/15" />
        {/* Soft radial spotlight behind the heading. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl"
        />
        <div className="relative">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your first step starts in the browser you already have.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            No signup, no setup — start the guided Path, or jump straight into a lab.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 text-base bg-linear-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25 hover:from-fuchsia-500 hover:to-violet-500"
            >
              <Link href="/path">
                <Route className="mr-1.5" /> Start the Path
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 text-base">
              <Link href="/labs/interview">
                <Mic className="mr-1.5" /> Take a mock interview
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
