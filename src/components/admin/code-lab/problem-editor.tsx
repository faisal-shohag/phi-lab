'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Save, CheckCircle2, XCircle, Plus, Trash2, Wand2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HiveMarkdown } from '@/components/hive/markdown'
import { cn } from '@/lib/utils'
import type { CaseResult, CodeLanguage, ProblemDifficulty, ProblemTests, ProblemType, TestCase } from '@/lib/code-lab/types'

interface EditableCase {
  id: string
  hidden: boolean
  argsText: string
  expectedText: string
  expectedStdout: string
}

export interface EditorInitial {
  id?: string
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  description: string
  constraints: string[]
  hints: string[]
  tags: string[]
  fnName: string | null
  languages: CodeLanguage[]
  starterJs: string
  starterTs: string
  solutionJs: string
  tests: ProblemTests
  xp: number
  published: boolean
}

const EMPTY: EditorInitial = {
  slug: '',
  title: '',
  difficulty: 'EASY',
  type: 'FUNCTION_RETURN',
  description: '',
  constraints: [],
  hints: [],
  tags: [],
  fnName: '',
  languages: ['JAVASCRIPT', 'TYPESCRIPT'],
  starterJs: '',
  starterTs: '',
  solutionJs: '',
  tests: { cases: [] },
  xp: 30,
  published: false,
}

export function ProblemEditor({ initial }: { initial?: EditorInitial }) {
  const router = useRouter()
  const start = initial ?? EMPTY
  const [form, setForm] = useState<EditorInitial>(start)
  const [cases, setCases] = useState<EditableCase[]>(toEditable(start.tests))
  const [validation, setValidation] = useState<{ ok: boolean; results: CaseResult[]; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)

  // AI bar
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)

  const set = <K extends keyof EditorInitial>(k: K, v: EditorInitial[K]) => setForm((f) => ({ ...f, [k]: v }))

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/code-lab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty: form.difficulty, type: form.type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? 'Generation failed')
      const draft = data as EditorInitial
      setForm({ ...draft, published: false })
      setCases(toEditable(draft.tests))
      setValidation(null)
      toast.success('Draft generated and validated. Review, then save.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const buildTests = (): ProblemTests => ({
    cases: cases.map<TestCase>((c) => ({
      id: c.id,
      hidden: c.hidden,
      args: parseJsonArray(c.argsText),
      ...(form.type === 'FUNCTION_RETURN'
        ? { expected: parseJson(c.expectedText) }
        : { expectedStdout: c.expectedStdout }),
    })),
  })

  const validate = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const res = await fetch('/api/admin/code-lab/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, fnName: form.fnName, solutionJs: form.solutionJs, tests: buildTests() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? 'Validation failed')
      setValidation({ ok: data.ok, results: data.results, error: data.error })
      if (data.ok && data.computed) {
        // Fill in expected values from the solution output.
        setCases(toEditable(data.computed))
        toast.success('Solution passes. Expected values synced from the solution.')
      } else if (!data.ok) {
        toast.error('Solution does not pass every case. Fix before publishing.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const save = async (publish?: boolean) => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        published: publish ?? form.published,
        fnName: form.fnName || null,
        tests: buildTests(),
      }
      const url = form.id ? `/api/admin/code-lab/problems/${form.id}` : '/api/admin/code-lab/problems'
      const res = await fetch(url, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? 'Save failed')
      toast.success(form.id ? 'Saved.' : 'Created.')
      router.push('/admin/code-lab')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addCase = () =>
    setCases((cs) => [...cs, { id: `t${cs.length + 1}`, hidden: false, argsText: '[]', expectedText: '', expectedStdout: '' }])
  const removeCase = (i: number) => setCases((cs) => cs.filter((_, idx) => idx !== i))
  const updateCase = (i: number, patch: Partial<EditableCase>) =>
    setCases((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  return (
    <div className="space-y-6">
      {/* AI generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4" /> Generate with AI</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-64 space-y-1">
            <Label className="text-xs">Topic / idea</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. merge two sorted arrays" />
          </div>
          <Button onClick={generate} disabled={generating || !topic.trim()}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate draft
          </Button>
        </CardContent>
      </Card>

      {/* Meta */}
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Slug"><Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="kebab-case" /></Field>
          <Field label="Difficulty">
            <Select value={form.difficulty} onValueChange={(v) => set('difficulty', v as ProblemDifficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['EASY', 'MEDIUM', 'HARD', 'EXTRA_HARD'] as ProblemDifficulty[]).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => set('type', v as ProblemType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FUNCTION_RETURN">Function return</SelectItem>
                <SelectItem value="CONSOLE_OUTPUT">Console output</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Entry function name"><Input value={form.fnName ?? ''} onChange={(e) => set('fnName', e.target.value)} placeholder="e.g. twoSum" /></Field>
          <Field label="XP"><Input type="number" value={form.xp} onChange={(e) => set('xp', Number(e.target.value))} /></Field>
          <Field label="Solvable in" full>
            <div className="flex items-center gap-6">
              {(['JAVASCRIPT', 'TYPESCRIPT'] as CodeLanguage[]).map((lang) => (
                <label key={lang} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.languages.includes(lang)}
                    onCheckedChange={(on) =>
                      set('languages', on ? [...new Set([...form.languages, lang])] : form.languages.filter((l) => l !== lang))
                    }
                  />
                  {lang === 'JAVASCRIPT' ? 'JavaScript' : 'TypeScript'}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Tags (comma-separated)" full>
            <Input value={form.tags.join(', ')} onChange={(e) => set('tags', splitList(e.target.value))} />
          </Field>
          <Field label="Constraints (one per line)" full>
            <Textarea rows={2} value={form.constraints.join('\n')} onChange={(e) => set('constraints', splitLines(e.target.value))} />
          </Field>
          <Field label="Hints (one per line)" full>
            <Textarea rows={2} value={form.hints.join('\n')} onChange={(e) => set('hints', splitLines(e.target.value))} />
          </Field>
        </CardContent>
      </Card>

      {/* Description with preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Description (markdown)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Textarea rows={12} className="font-mono text-xs" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <div className="rounded-md border p-4">
            <HiveMarkdown className="text-sm">{form.description || '_Preview appears here_'}</HiveMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Code */}
      <Card>
        <CardHeader><CardTitle className="text-base">Starters & solution</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="JavaScript starter" full={false}>
            <Textarea rows={8} className="font-mono text-xs" value={form.starterJs} onChange={(e) => set('starterJs', e.target.value)} />
          </Field>
          <Field label="TypeScript starter" full={false}>
            <Textarea rows={8} className="font-mono text-xs" value={form.starterTs} onChange={(e) => set('starterTs', e.target.value)} />
          </Field>
          <Field label="Reference solution (JS, server-only)" full={false}>
            <Textarea rows={8} className="font-mono text-xs" value={form.solutionJs} onChange={(e) => set('solutionJs', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Tests */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Test cases</CardTitle>
          <Button variant="outline" size="sm" onClick={addCase}><Plus className="h-4 w-4" /> Add case</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cases.length === 0 && <p className="text-sm text-muted-foreground">No cases yet.</p>}
          {cases.map((c, i) => {
            const res = validation?.results.find((r) => r.id === c.id)
            return (
              <div key={c.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-medium">Case {i + 1}</span>
                  {res && <StatusPill status={res.status} />}
                  <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch checked={c.hidden} onCheckedChange={(v) => updateCase(i, { hidden: v })} /> Hidden
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => removeCase(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="args (JSON array)">
                    <Textarea rows={2} className="font-mono text-xs" value={c.argsText} onChange={(e) => updateCase(i, { argsText: e.target.value })} />
                  </Field>
                  {form.type === 'FUNCTION_RETURN' ? (
                    <Field label="expected (JSON)">
                      <Textarea rows={2} className="font-mono text-xs" value={c.expectedText} onChange={(e) => updateCase(i, { expectedText: e.target.value })} />
                    </Field>
                  ) : (
                    <Field label="expected stdout">
                      <Textarea rows={2} className="font-mono text-xs" value={c.expectedStdout} onChange={(e) => updateCase(i, { expectedStdout: e.target.value })} />
                    </Field>
                  )}
                </div>
                {res?.error && <p className="mt-1 text-xs text-destructive">{res.error}</p>}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {validation && (
        <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', validation.ok ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'border-destructive/30 text-destructive')}>
          {validation.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {validation.ok ? 'Solution passes every case.' : validation.error ?? 'Solution failed some cases.'}
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background/80 py-3 backdrop-blur">
        <Button variant="secondary" onClick={validate} disabled={validating}>
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Validate solution
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4" /> Save draft</Button>
          <Button onClick={() => save(true)} disabled={saving || !validation?.ok} title={!validation?.ok ? 'Validate the solution first' : undefined}>
            Publish
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: CaseResult['status'] }) {
  const ok = status === 'pass'
  return (
    <Badge variant="outline" className={ok ? 'text-emerald-600 border-emerald-500/40' : 'text-destructive border-destructive/40'}>
      {status}
    </Badge>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'sm:col-span-2')}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function toEditable(tests: ProblemTests): EditableCase[] {
  return (tests.cases ?? []).map((c) => ({
    id: c.id,
    hidden: c.hidden,
    argsText: JSON.stringify(c.args ?? []),
    expectedText: c.expected === undefined ? '' : JSON.stringify(c.expected),
    expectedStdout: c.expectedStdout ?? '',
  }))
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

function parseJsonArray(s: string): unknown[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : [v]
  } catch {
    return []
  }
}

function splitList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

function splitLines(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean)
}
