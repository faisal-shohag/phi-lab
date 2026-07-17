'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Trophy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DIFFICULTY_META } from '@/components/code-lab/difficulty'
import { cn } from '@/lib/utils'
import type { ProblemDifficulty } from '@/lib/code-lab/types'
import type { EligibleProblem } from '@/lib/code-lab/contest-admin'

interface Author { id: string; name: string; email: string }

export interface ContestEditorInitial {
  id: string
  slug: string
  title: string
  description: string
  authorId: string
  startsAt: string // ISO string
  endsAt: string // ISO string
  published: boolean
  problems: { problemId: string; points: number }[]
}

/** ISO -> the `YYYY-MM-DDTHH:mm` a datetime-local input wants, in browser time. */
function isoToLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface AttachedRow { problemId: string; points: number }

export function ContestEditor({
  initial,
  authors,
  eligible,
}: {
  initial?: ContestEditorInitial
  authors: Author[]
  eligible: EligibleProblem[]
}) {
  const router = useRouter()
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [authorId, setAuthorId] = useState(initial?.authorId ?? '')
  const [startsAt, setStartsAt] = useState(() => isoToLocalInput(initial?.startsAt ?? ''))
  const [endsAt, setEndsAt] = useState(() => isoToLocalInput(initial?.endsAt ?? ''))
  const [rows, setRows] = useState<AttachedRow[]>(initial?.problems ?? [])
  const [pick, setPick] = useState('')
  const [saving, setSaving] = useState(false)

  const problemById = new Map(eligible.map((p) => [p.id, p]))
  const available = eligible.filter((p) => !rows.some((r) => r.problemId === p.id))

  const addProblem = () => {
    if (!pick) return
    setRows((prev) => [...prev, { problemId: pick, points: 100 }])
    setPick('')
  }
  const removeAt = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i))
  const setPoints = (i: number, points: number) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, points } : r)))
  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const save = async (publish: boolean) => {
    setSaving(true)
    try {
      const body = {
        slug, title, description, authorId,
        startsAt: startsAt ? new Date(startsAt).toISOString() : '',
        endsAt: endsAt ? new Date(endsAt).toISOString() : '',
        published: publish,
        problems: rows.map((r, i) => ({ problemId: r.problemId, points: r.points, order: i })),
      }
      const url = initial ? `/api/admin/code-lab/contests/${initial.id}` : '/api/admin/code-lab/contests'
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
      if (!res.ok) {
        toast.error(data?.message ?? 'Save failed.')
        return
      }
      toast.success(publish ? 'Contest published.' : 'Contest saved.')
      router.push('/admin/code-lab/contests')
      router.refresh()
    } catch {
      toast.error('Save failed. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Sprint #1" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="weekly-sprint-1" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description (markdown)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Rules, theme, prizes…" />
          </div>
          <div className="space-y-1.5">
            <Label>Author</Label>
            <Select value={authorId} onValueChange={setAuthorId}>
              <SelectTrigger><SelectValue placeholder="Select mentor / admin" /></SelectTrigger>
              <SelectContent>
                {authors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} <span className="text-muted-foreground">· {a.email}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div />
          <div className="space-y-1.5">
            <Label>Starts at</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ends at</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problems &amp; points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="flex-1 min-w-56"><SelectValue placeholder="Attach a published problem" /></SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No more eligible problems.</div>
                ) : (
                  available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title} <span className="text-muted-foreground">/{p.slug}</span></SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addProblem} disabled={!pick}>
              <Plus className="h-4 w-4" /> Add
            </Button>
            <Button asChild type="button" variant="ghost" size="sm">
              <Link href="/admin/code-lab/new" target="_blank">
                <ExternalLink className="h-4 w-4" /> Author a new problem
              </Link>
            </Button>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No problems attached. Add published problems above — author and validate new ones in the Problems tool first.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r, i) => {
                const p = problemById.get(r.problemId)
                return (
                  <li key={r.problemId} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="w-5 text-center font-mono text-sm text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1 truncate text-sm font-medium">{p?.title ?? r.problemId}</span>
                    {p && <DifficultyTag difficulty={p.difficulty} />}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        value={r.points}
                        onChange={(e) => setPoints(i, Number(e.target.value))}
                        className="h-8 w-20"
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>
                    <div className="flex items-center">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAt(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          <Save className="h-4 w-4" /> Save draft
        </Button>
        <Button onClick={() => save(true)} disabled={saving}>
          <Trophy className="h-4 w-4" /> {initial?.published ? 'Save & keep published' : 'Publish'}
        </Button>
      </div>
    </div>
  )
}

function DifficultyTag({ difficulty }: { difficulty: ProblemDifficulty }) {
  return (
    <Badge variant="outline" className={cn('hidden sm:inline-flex', DIFFICULTY_META[difficulty].className)}>
      {DIFFICULTY_META[difficulty].label}
    </Badge>
  )
}
