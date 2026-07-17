import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listContests } from '@/lib/code-lab/contest-admin'
import { ContestsAdmin } from '@/components/admin/code-lab/contests-admin'

export default async function AdminContestsPage() {
  const contests = await listContests()
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contests</h1>
          <p className="text-muted-foreground text-sm">Arrange timed contests from published problems.</p>
        </div>
        <Button asChild>
          <Link href="/admin/code-lab/contests/new"><Plus className="h-4 w-4" /> New contest</Link>
        </Button>
      </div>
      <ContestsAdmin initial={contests} />
    </>
  )
}
