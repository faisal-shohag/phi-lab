import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth-server'
import { getContestProblemForLearner } from '@/lib/code-lab/contests'
import { Workspace } from '@/components/code-lab/workspace'

export async function generateMetadata({ params }: { params: Promise<{ problemSlug: string }> }): Promise<Metadata> {
  const { problemSlug } = await params
  return { title: `${problemSlug} · Contest · Code Lab` }
}

export default async function ContestProblemPage({
  params,
}: {
  params: Promise<{ slug: string; problemSlug: string }>
}) {
  const { slug, problemSlug } = await params
  const user = await requireUser()
  if (!user) redirect(`/sign-in?redirect=/labs/code-lab/contests/${slug}/${problemSlug}`)

  // Null unless the contest is RUNNING and the problem belongs to it.
  const entry = await getContestProblemForLearner(slug, problemSlug, user.id)
  if (!entry) notFound()

  return (
    <Workspace
      problem={entry.problem}
      initialTab="description"
      contest={{
        id: entry.contest.id,
        slug: entry.contest.slug,
        title: entry.contest.title,
        endsAt: entry.contest.endsAt,
        points: entry.points,
      }}
    />
  )
}
