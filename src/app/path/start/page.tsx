import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth-server'
import { getProfile } from '@/lib/path/profile'
import { OnboardingFlow } from '@/components/path/onboarding-flow'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = {
  title: 'Start your path',
  description: 'Three quick questions and we chart a route that skips what you already know.',
}

export default async function PathStartPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/path/start')

  // Already onboarded? The gate is one-way — send them to the map.
  const profile = await getProfile(user.id)
  if (profile?.onboarded) redirect('/path')

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">The Path</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Let&apos;s find your starting point</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <OnboardingFlow userName={user.name || 'Learner'} />
      </main>
    </div>
  )
}
