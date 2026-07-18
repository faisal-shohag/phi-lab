'use client'

import { Suspense, use, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Send, RotateCcw, Lightbulb, CheckCircle2, Tags, Code2, FileText, History, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { HiveMarkdown } from '@/components/hive/markdown'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Trophy } from 'lucide-react'
import { CodeEditor } from './code-editor'
import { EditorSettingsMenu } from './editor-settings'
import { TestResults } from './test-results'
import { SubmissionsTab } from './submissions-tab'
import { DIFFICULTY_META } from './difficulty'
import { useContestClock, Countdown } from './countdown'
import { useRunner } from '@/lib/code-lab/use-runner'
import { loadDraft, saveDraft, clearDraft } from '@/lib/code-lab/drafts'
import { refreshXp } from '@/lib/gamification/use-xp'
import { cn } from '@/lib/utils'
import { stableSerialize } from '@/lib/code-lab/serialize'
import type { LearnerProblem, ProblemStats } from '@/lib/code-lab/queries'
import type { CodeLanguage, SubmitResponse } from '@/lib/code-lab/types'

type LeftTab = 'description' | 'submissions'
type ResultTab = 'testcase' | 'result'

export interface ContestContext {
  id: string
  slug: string
  title: string
  endsAt: Date
  points: number
}

export function Workspace({
  problem,
  initialTab,
  contest,
  stats,
}: {
  problem: LearnerProblem
  initialTab: LeftTab
  contest?: ContestContext
  /** Solver/attempt counts, streamed in so they don't block the editor paint. */
  stats?: Promise<ProblemStats>
}) {
  const starterFor = (lang: CodeLanguage) => (lang === 'TYPESCRIPT' ? problem.starterTs : problem.starterJs)
  const allowed = problem.languages.length > 0 ? problem.languages : (['JAVASCRIPT', 'TYPESCRIPT'] as CodeLanguage[])
  const initialLang: CodeLanguage = allowed.includes('JAVASCRIPT') ? 'JAVASCRIPT' : 'TYPESCRIPT'

  const [language, setLanguage] = useState<CodeLanguage>(initialLang)
  const [code, setCode] = useState(() => loadDraft(problem.id, initialLang) ?? starterFor(initialLang))
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [solved, setSolved] = useState(problem.solved)
  const [leftTab, setLeftTab] = useState<LeftTab>(initialTab)
  const [resultTab, setResultTab] = useState<ResultTab>('testcase')
  const [subsReloadKey, setSubsReloadKey] = useState(0)
  const [helpOpen, setHelpOpen] = useState<string[]>([])
  const helpRef = useRef<HTMLDivElement>(null)
  const runner = useRunner()

  const changeTab = (tab: LeftTab) => {
    setLeftTab(tab)
    // Reflect the tab in the URL without a navigation/re-render.
    const url = tab === 'description' ? window.location.pathname : `${window.location.pathname}?tab=submissions`
    window.history.replaceState(null, '', url)
  }

  // Jump to the Topics/Hints accordion at the end of the description and open it.
  const revealHelp = (item: 'topics' | 'hints') => {
    if (leftTab !== 'description') changeTab('description')
    setHelpOpen((prev) => (prev.includes(item) ? prev : [...prev, item]))
    requestAnimationFrame(() => helpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const changeLanguage = (lang: CodeLanguage) => {
    setLanguage(lang)
    setCode(loadDraft(problem.id, lang) ?? starterFor(lang))
    setSubmitResult(null)
    runner.reset()
  }

  const onCodeChange = (v: string) => {
    setCode(v)
    saveDraft(problem.id, language, v)
  }

  const onRun = () => {
    setSubmitResult(null)
    setResultTab('result')
    runner.run({ language, code, problemType: problem.type, fnName: problem.fnName, cases: problem.sampleCases })
  }

  const onReset = () => {
    setCode(starterFor(language))
    clearDraft(problem.id, language)
    setSubmitResult(null)
    runner.reset()
  }

  const onSubmit = async () => {
    setSubmitting(true)
    setSubmitResult(null)
    setResultTab('result')
    runner.reset()
    try {
      const res = await fetch('/api/code-lab/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: problem.id, language, code, contestId: contest?.id }),
      })
      const data = (await res.json().catch(() => null)) as SubmitResponse | { error: string; message?: string } | null
      if (!res.ok || !data || 'error' in data) {
        toast.error((data as { message?: string })?.message ?? 'Submission failed. Try again.')
        return
      }
      setSubmitResult(data)
      setSubsReloadKey((k) => k + 1)
      if (data.verdict === 'ACCEPTED') {
        setSolved(true)
        toast.success('Accepted!', { description: data.xp?.awarded ? `+${data.xp.xpGained} XP` : 'Already solved.' })
        if (data.xp?.awarded) void refreshXp()
      } else {
        toast.error(verdictLabel(data.verdict), { description: `${data.passedCount}/${data.totalCount} tests passed` })
      }
    } catch {
      toast.error('Submission failed. Check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const diff = DIFFICULTY_META[problem.difficulty]
  const busy = runner.running || submitting

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* Top toolbar */}
      <header className="flex items-center gap-2 border-b bg-background px-3 py-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link href={contest ? `/labs/code-lab/contests/${contest.slug}` : '/labs/code-lab'}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{contest ? 'Contest' : 'Problem List'}</span>
          </Link>
        </Button>

        {contest && <ContestClockBadge contest={contest} />}

        {/* Centered Run / Submit */}
        <div className="mx-auto flex items-center gap-1.5 rounded-lg bg-muted p-1">
          <Button variant="ghost" size="sm" onClick={onRun} disabled={busy} className="h-8">
            {runner.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={busy} className="h-8 bg-emerald-600 text-white hover:bg-emerald-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <XpBadge />
          <AnimatedThemeToggler />
          <UserMenu />
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 gap-1.5 p-1.5">
        {/* Left: description / submissions */}
        <ResizablePanel defaultSize={42} minSize={25} className="overflow-hidden rounded-xl border bg-background">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-4 border-b px-4 py-2 text-sm">
              <TabButton active={leftTab === 'description'} onClick={() => changeTab('description')}>
                <FileText className="h-4 w-4" /> Description
              </TabButton>
              <TabButton active={leftTab === 'submissions'} onClick={() => changeTab('submissions')}>
                <History className="h-4 w-4" /> Submissions
              </TabButton>
            </div>

            {leftTab === 'description' ? (
              <div className="min-h-0 flex-1 overflow-auto p-5">
                <div className="mb-2 flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{problem.title}</h1>
                  {solved && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Solved
                    </span>
                  )}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn('rounded-full', diff.className)}>{diff.label}</Badge>
                  {stats && (
                    <Suspense fallback={<StatsPlaceholder />}>
                      <ProblemStatsBadges statsPromise={stats} />
                    </Suspense>
                  )}
                  {problem.tags.length > 0 && (
                    <button onClick={() => revealHelp('topics')} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                      <Tags className="h-3.5 w-3.5" /> Topics
                    </button>
                  )}
                  {problem.hints.length > 0 && (
                    <button onClick={() => revealHelp('hints')} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                      <Lightbulb className="h-3.5 w-3.5" /> Hint
                    </button>
                  )}
                  <Badge variant="outline" className="ml-auto rounded-full">{problem.xp} XP</Badge>
                </div>

                <HiveMarkdown className="text-sm">{problem.description}</HiveMarkdown>

                {problem.constraints.length > 0 && (
                  <div className="mt-5">
                    <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Constraints</h2>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {problem.constraints.map((c, i) => (
                        <li key={i}><code className="text-xs">{c}</code></li>
                      ))}
                    </ul>
                  </div>
                )}

                {problem.sampleCases.length > 0 && (
                  <div className="mt-5">
                    <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sample testcases</h2>
                    <div className="space-y-2">
                      {problem.sampleCases.map((c, i) => (
                        <div key={c.id} className="rounded-md border bg-muted/30 p-3 text-xs">
                          <p className="mb-1 font-medium text-muted-foreground">Example {i + 1}</p>
                          {(c.args ?? []).map((a, j) => (
                            <ExampleRow key={j} label={problem.paramNames[j] ?? `arg${j}`} value={stableSerialize(a)} />
                          ))}
                          <ExampleRow
                            label="Output"
                            value={problem.type === 'FUNCTION_RETURN' ? stableSerialize(c.expected) : c.expectedStdout ?? ''}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(problem.tags.length > 0 || problem.hints.length > 0) && (
                  <div ref={helpRef} className="mt-6 scroll-mt-4">
                    <Accordion type="multiple" value={helpOpen} onValueChange={setHelpOpen}>
                      {problem.tags.length > 0 && (
                        <AccordionItem value="topics">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-1.5"><Tags className="h-4 w-4" /> Topics</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-1.5">
                              {problem.tags.map((t) => (
                                <Badge key={t} variant="secondary">{t}</Badge>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                      {problem.hints.length > 0 && (
                        <AccordionItem value="hints">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-1.5"><Lightbulb className="h-4 w-4" /> Hints</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            {problem.hints.map((h, i) => (
                              <div key={i} className="rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Hint {i + 1}. </span>{h}
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </div>
                )}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <SubmissionsTab
                  problemId={problem.id}
                  reloadKey={subsReloadKey}
                  type={problem.type}
                  paramNames={problem.paramNames}
                  sampleCases={problem.sampleCases}
                />
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: editor + testcase */}
        <ResizablePanel defaultSize={58} minSize={30}>
          <ResizablePanelGroup orientation="vertical" className="gap-1.5">
            <ResizablePanel defaultSize={62} minSize={20} className="overflow-hidden rounded-xl border bg-background">
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Code2 className="h-4 w-4" /> Code
                  </span>
                  <Separator orientation="vertical" className="mx-1 h-4" />
                  <Select value={language} onValueChange={(v) => changeLanguage(v as CodeLanguage)} disabled={allowed.length < 2}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allowed.includes('JAVASCRIPT') && <SelectItem value="JAVASCRIPT">JavaScript</SelectItem>}
                      {allowed.includes('TYPESCRIPT') && <SelectItem value="TYPESCRIPT">TypeScript</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={onReset} title="Reset to starter">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <EditorSettingsMenu />
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <CodeEditor language={language} value={code} onChange={onCodeChange} />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize={38} minSize={15} className="overflow-hidden rounded-xl border bg-background">
              <TestResults
                type={problem.type}
                paramNames={problem.paramNames}
                sampleCases={problem.sampleCases}
                run={runner}
                submit={submitResult}
                submitting={submitting}
                tab={resultTab}
                onTabChange={setResultTab}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function ProblemStatsBadges({ statsPromise }: { statsPromise: Promise<ProblemStats> }) {
  const { solvedCount, attemptCount } = use(statsPromise)
  return (
    <>
      <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Learners who solved this">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {solvedCount.toLocaleString()} solved
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Learners who attempted this">
        <Users className="h-3.5 w-3.5" /> {attemptCount.toLocaleString()} attempted
      </span>
    </>
  )
}

function StatsPlaceholder() {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
      <CheckCircle2 className="h-3.5 w-3.5" /> … solved
    </span>
  )
}

function ExampleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="shrink-0 font-medium text-muted-foreground">{label}:</span>
      <pre className="overflow-auto whitespace-pre-wrap break-all font-mono">{value}</pre>
    </div>
  )
}

function ContestClockBadge({ contest }: { contest: ContestContext }) {
  // startsAt is in the past here (we only reach the solve page while RUNNING),
  // so this ticks down to endsAt and flips to a closed state at zero.
  const { status, secondsLeft } = useContestClock(new Date(0), contest.endsAt)
  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex',
        status === 'RUNNING'
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground',
      )}
      title={contest.title}
    >
      <Trophy className="h-3.5 w-3.5" />
      {status === 'RUNNING' ? (
        <>Ends in <Countdown secondsLeft={secondsLeft} /> · {contest.points} pts</>
      ) : (
        'Contest ended'
      )}
    </span>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 pb-1.5 font-medium transition-colors -mb-2.5',
        active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function verdictLabel(v: string): string {
  return (
    { WRONG_ANSWER: 'Wrong Answer', RUNTIME_ERROR: 'Runtime Error', TIME_LIMIT: 'Time Limit Exceeded', COMPILE_ERROR: 'Compile Error' } as Record<string, string>
  )[v] ?? v
}
