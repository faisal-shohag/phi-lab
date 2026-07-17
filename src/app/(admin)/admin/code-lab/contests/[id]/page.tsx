import { notFound } from 'next/navigation'
import { getContest, listAuthors, eligibleProblems } from '@/lib/code-lab/contest-admin'
import { ContestEditor, type ContestEditorInitial } from '@/components/admin/code-lab/contest-editor'

export default async function EditContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [contest, authors, eligible] = await Promise.all([
    getContest(id),
    listAuthors(),
    eligibleProblems(id),
  ])
  if (!contest) notFound()

  const initial: ContestEditorInitial = {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    description: contest.description,
    authorId: contest.authorId,
    startsAt: contest.startsAt.toISOString(),
    endsAt: contest.endsAt.toISOString(),
    published: contest.published,
    problems: contest.problems.map((cp) => ({ problemId: cp.problemId, points: cp.points })),
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit contest</h1>
        <p className="text-muted-foreground text-sm">{contest.title}</p>
      </div>
      <ContestEditor initial={initial} authors={authors} eligible={eligible} />
    </>
  )
}
