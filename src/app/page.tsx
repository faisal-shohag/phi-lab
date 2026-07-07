import { LandingHeader } from '@/components/landing/landing-header'
import { Hero } from '@/components/landing/hero'
import { LabsShowcase } from '@/components/landing/labs-showcase'
import { Journey } from '@/components/landing/journey'
import { Features } from '@/components/landing/features'
import { Cta } from '@/components/landing/cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <LandingHeader />
      <main>
        <Hero />
        <LabsShowcase />
        <Journey />
        <Features />
        <Cta />
      </main>
      <LandingFooter />
    </div>
  )
}
