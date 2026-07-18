import { ProblemEditor } from '@/components/admin/code-lab/problem-editor'

export default function NewProblemPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New problem</h1>
        <p className="text-muted-foreground text-sm">Generate a draft with AI or fill it in by hand.</p>
      </div>
      <ProblemEditor />
    </>
  )
}
