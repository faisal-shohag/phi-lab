import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Trophy } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { listVisibleContests } from '@/lib/code-lab/contests'
import { ContestCard } from '@/components/code-lab/contest-card'
import { LabHeader } from '@/components/code-lab/lab-header'

export const metadata: Metadata = { title: 'Contests · Code Lab' }

export default async function ContestsPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/code-lab/contests')

  const contests = await listVisibleContests()
  const running = contests.filter((c) => c.status === 'RUNNING')
  const upcoming = contests.filter((c) => c.status === 'UPCOMING')
  const finished = contests.filter((c) => c.status === 'FINISHED')

  return (
    <div className="min-h-screen bg-background">
      <LabHeader subtitle="Timed programming contests" backHref="/labs/code-lab" backLabel="Problems" />

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        {contests.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No contests yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <Group title="Live now" contests={running} />
            <Group title="Upcoming" contests={upcoming} />
            <Group title="Finished" contests={finished} />
          </div>
        )}
      </main>
    </div>
  )
}

function Group({ title, contests }: { title: string; contests: React.ComponentProps<typeof ContestCard>['contest'][] }) {
  if (contests.length === 0) return null
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {contests.map((c) => (
          <ContestCard key={c.slug} contest={c} />
        ))}
      </div>
    </section>
  )
}
