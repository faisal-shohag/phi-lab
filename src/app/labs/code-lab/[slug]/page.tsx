import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth-server'
import { getLearnerProblem, getProblemStats } from '@/lib/code-lab/queries'
import { Workspace } from '@/components/code-lab/workspace'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { title: `${slug} · Code Lab` }
}

export default async function CodeLabProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireUser()
  const { slug } = await params
  if (!user) redirect(`/sign-in?redirect=/labs/code-lab/${slug}`)

  const problem = await getLearnerProblem(slug, user.id)
  if (!problem) notFound()

  const { tab } = await searchParams
  const initialTab = tab === 'submissions' ? 'submissions' : 'description'

  // Not awaited — streamed to the client so the counts fill in without blocking
  // the editor.
  const stats = getProblemStats(problem.id)

  return <Workspace problem={problem} initialTab={initialTab} stats={stats} />
}
