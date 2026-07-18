import { listAuthors, eligibleProblems } from '@/lib/code-lab/contest-admin'
import { ContestEditor } from '@/components/admin/code-lab/contest-editor'

export default async function NewContestPage() {
  const [authors, eligible] = await Promise.all([listAuthors(), eligibleProblems()])
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New contest</h1>
        <p className="text-muted-foreground text-sm">Arrange problems, set points, and schedule the window.</p>
      </div>
      <ContestEditor authors={authors} eligible={eligible} />
    </>
  )
}
