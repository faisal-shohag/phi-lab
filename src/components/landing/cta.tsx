'use client'

import Link from 'next/link'
import { Cpu, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <Reveal className="relative overflow-hidden rounded-2xl border-2 border-border bg-card p-8 text-center shadow-sm sm:p-14">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-fuchsia-500/10 to-violet-600/10" />
        <div className="relative">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Your first step starts in the browser you already have.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            No signup, no setup — pick a lab and start learning by doing.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 text-base">
              <Link href="/labs/js-motion">
                <Cpu className="mr-1.5" /> Step through code
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
