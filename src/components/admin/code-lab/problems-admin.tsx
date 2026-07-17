'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DIFFICULTY_META } from '@/components/code-lab/difficulty'
import { cn } from '@/lib/utils'
import type { ProblemDifficulty, ProblemType } from '@/lib/code-lab/types'

interface Row {
  id: string
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  published: boolean
  submissions: number
}

export function ProblemsAdmin({ initial }: { initial: Row[] }) {
  const router = useRouter()
  const [seeding, setSeeding] = useState(false)

  const seed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/admin/code-lab/seed', { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { seeded: number }
      toast.success(`Seeded ${data.seeded} demo problems.`)
      router.refresh()
    } catch {
      toast.error('Seeding failed.')
    } finally {
      setSeeding(false)
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/code-lab/problems/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Problem deleted.')
      router.refresh()
    } catch {
      toast.error('Delete failed.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/admin/code-lab/new"><Plus className="h-4 w-4" /> New problem</Link>
        </Button>
        <Button variant="outline" onClick={seed} disabled={seeding}>
          <Sparkles className="h-4 w-4" /> {seeding ? 'Seeding…' : 'Seed demo problems'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Submissions</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No problems yet. Create one or seed the demo set.
                </TableCell>
              </TableRow>
            ) : (
              initial.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/code-lab/${p.id}`} className="hover:underline">{p.title}</Link>
                    <span className="ml-1 text-xs text-muted-foreground">/{p.slug}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(DIFFICULTY_META[p.difficulty].className)}>
                      {DIFFICULTY_META[p.difficulty].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{p.type === 'FUNCTION_RETURN' ? 'Return' : 'Console'}</TableCell>
                  <TableCell>
                    <Badge variant={p.published ? 'default' : 'secondary'}>{p.published ? 'Published' : 'Draft'}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.submissions}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {p.published && (
                        <Button asChild variant="ghost" size="icon" title="Open in Code Lab">
                          <Link href={`/labs/code-lab/${p.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete “{p.title}”?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes the problem and all {p.submissions} of its submissions. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(p.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
