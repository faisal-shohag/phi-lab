import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Code2 } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { listProblemsForUser } from '@/lib/code-lab/queries'
import { listVisibleContests } from '@/lib/code-lab/contests'
import { ProblemList } from '@/components/code-lab/problem-list'
import { ContestRail } from '@/components/code-lab/contest-rail'
import { LabHeader } from '@/components/code-lab/lab-header'

export const metadata: Metadata = { title: 'Code Lab' }

export default async function CodeLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/code-lab')

  const [problems, contests] = await Promise.all([
    listProblemsForUser(user.id),
    listVisibleContests(),
  ])

  return (
    <div className="min-h-screen bg-background">
      <LabHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <ContestRail contests={contests} />
        {problems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Code2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No problems published yet. Check back soon.</p>
          </div>
        ) : (
          <ProblemList problems={problems} />
        )}
      </main>
    </div>
  )
}
