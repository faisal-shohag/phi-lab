'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ExternalLink, Radio } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { ContestStatus } from '@/lib/code-lab/contest-status'

interface Row {
  id: string
  slug: string
  title: string
  status: ContestStatus
  published: boolean
  startsAt: string | Date
  endsAt: string | Date
  problemCount: number
}

export function ContestsAdmin({ initial }: { initial: Row[] }) {
  const router = useRouter()

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/code-lab/contests/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Contest deleted.')
      router.refresh()
    } catch {
      toast.error('Delete failed.')
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Window</TableHead>
            <TableHead className="text-right">Problems</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {initial.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No contests yet. Create one.
              </TableCell>
            </TableRow>
          ) : (
            initial.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/code-lab/contests/${c.id}`} className="hover:underline">{c.title}</Link>
                  <span className="ml-1 text-xs text-muted-foreground">/{c.slug}</span>
                  {!c.published && <Badge variant="secondary" className="ml-2">Draft</Badge>}
                </TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmt(c.startsAt)} → {fmt(c.endsAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.problemCount}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {c.published && (
                      <Button asChild variant="ghost" size="icon" title="Open">
                        <Link href={`/labs/code-lab/contests/${c.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{c.title}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the contest and unlinks its problems (attempts are kept). This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(c.id)}>Delete</AlertDialogAction>
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
  )
}

function StatusBadge({ status }: { status: ContestStatus }) {
  if (status === 'RUNNING')
    return <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><Radio className="h-3 w-3 animate-pulse" /> Live</Badge>
  if (status === 'UPCOMING') return <Badge variant="outline" className="text-amber-600 dark:text-amber-400">Upcoming</Badge>
  return <Badge variant="secondary">Finished</Badge>
}

function fmt(d: string | Date): string {
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
