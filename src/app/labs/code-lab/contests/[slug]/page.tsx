import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth-server'
import { getContestForLearner } from '@/lib/code-lab/contests'
import { ContestView } from '@/components/code-lab/contest-view'
import { LabHeader } from '@/components/code-lab/lab-header'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { title: `${slug} · Contest · Code Lab` }
}

export default async function ContestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  if (!user) redirect(`/sign-in?redirect=/labs/code-lab/contests/${slug}`)

  const contest = await getContestForLearner(slug, user.id)
  if (!contest) notFound()

  return (
    <div className="min-h-screen bg-background">
      <LabHeader subtitle="Timed programming contest" backHref="/labs/code-lab/contests" backLabel="Contests" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <ContestView contest={contest} />
      </main>
    </div>
  )
}
