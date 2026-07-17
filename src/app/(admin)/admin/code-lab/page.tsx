import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listProblems } from '@/lib/code-lab/admin'
import { ProblemsAdmin } from '@/components/admin/code-lab/problems-admin'

export default async function AdminCodeLabPage() {
  const problems = await listProblems()
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Code Lab</h1>
          <p className="text-muted-foreground text-sm">Author problems, generate with AI, and publish.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/code-lab/contests"><Trophy className="h-4 w-4" /> Contests</Link>
        </Button>
      </div>
      <ProblemsAdmin initial={problems} />
    </>
  )
}
