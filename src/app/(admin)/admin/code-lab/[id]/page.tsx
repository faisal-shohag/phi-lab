import { notFound } from 'next/navigation'
import { getProblem } from '@/lib/code-lab/admin'
import { ProblemEditor, type EditorInitial } from '@/components/admin/code-lab/problem-editor'
import type { ProblemTests } from '@/lib/code-lab/types'

export default async function EditProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await getProblem(id)
  if (!p) notFound()

  const initial: EditorInitial = {
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    type: p.type,
    description: p.description,
    constraints: p.constraints,
    hints: p.hints,
    tags: p.tags,
    fnName: p.fnName,
    languages: p.languages.length > 0 ? p.languages : ['JAVASCRIPT', 'TYPESCRIPT'],
    starterJs: p.starterJs,
    starterTs: p.starterTs,
    solutionJs: p.solutionJs,
    tests: (p.tests as unknown as ProblemTests) ?? { cases: [] },
    xp: p.xp,
    published: p.published,
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit problem</h1>
        <p className="text-muted-foreground text-sm">{p.title}</p>
      </div>
      <ProblemEditor initial={initial} />
    </>
  )
}
