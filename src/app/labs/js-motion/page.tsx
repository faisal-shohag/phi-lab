'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Code2,
  Terminal,
  Cpu,
  AlertCircle,
  Lightbulb,
  Zap,
  Play,
  FilePlus2,
  Share2,
  BarChart3,
  GraduationCap,
  Lock,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { interpret, getParseError, RuntimeError } from '@/lib/visualizer/interpreter'
import { playStepSound, playFinishSound, unlockAudio, playGoSting } from '@/lib/visualizer/sound'
import { authClient } from '@/lib/auth-client'
import { AiTutor, type TutorLang, type TutorRequest } from '@/components/visualizer/ai-tutor'
import { AiInsights } from '@/components/visualizer/ai-insights'
import { DEMO_EXAMPLES } from '@/lib/visualizer/examples'
import type { Step, Trace } from '@/lib/visualizer/types'
import { heapMap } from '@/lib/visualizer/values'
import { buildQuestion, type QuizQuestion } from '@/lib/visualizer/quiz'
import { encodeCodeToUrl, readCodeFromLocation, syncCodeToLocation } from '@/lib/visualizer/share'
import { useVisualizerSettings } from '@/lib/visualizer/settings'
import {
  buildLoops,
  activeLoop,
  buildCallTree,
  activeCallId,
  consoleEntries,
} from '@/lib/visualizer/features'
import { MemoryPanel } from '@/components/visualizer/call-stack'
import { HeapGraph } from '@/components/visualizer/heap-graph'
import { Timeline, StepLegend } from '@/components/visualizer/timeline'
import { HeatTrail } from '@/components/visualizer/heat-trail'
import { PlaybackControls } from '@/components/visualizer/playback-controls'
import { CodeEditor, type EditorHighlight } from '@/components/visualizer/code-editor'
import { QuizOverlay } from '@/components/visualizer/quiz-overlay'
import { SettingsPanel } from '@/components/visualizer/settings-panel'
import { DiffFlash } from '@/components/visualizer/diff-flash'
import { ConsoleLane } from '@/components/visualizer/console-lane'
import { LoopUnroll } from '@/components/visualizer/loop-unroll'
import { RecursionTree } from '@/components/visualizer/recursion-tree'
import { EventLoopPanel } from '@/components/visualizer/event-loop'
import { ClosureCapture } from '@/components/visualizer/closure-capture'
import { HoistingPanel } from '@/components/visualizer/hoisting-panel'
import { FlowChart } from '@/components/visualizer/flow-chart'
import { CallStackPanel } from '@/components/visualizer/call-stack-panel'
import { FlameGraph } from '@/components/visualizer/flame-graph'
import { FloatingWindow } from '@/components/visualizer/floating-window'
import { ComplexityMeter } from '@/components/visualizer/complexity-meter'
import {
  Variable as VariableIcon,
  Network as NetworkIcon,
  Repeat as RepeatIcon,
  GitBranch as GitBranchIcon,
  Timer as TimerIcon,
  Lasso as LassoIcon,
  Layers as LayersIcon,
  Workflow as WorkflowIcon,
  ArrowUpNarrowWide as HoistIcon,
  Flame as FlameIcon,
  X as XIcon,
  Plus as PlusIcon,
  PictureInPicture2 as PopOutIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FeatureKey } from '@/lib/visualizer/settings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Toaster } from '@/components/ui/sonner'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { XpBadge } from '@/components/gamification/xp-badge'
import { XpHint } from '@/components/gamification/xp-hint'
import { UserMenu } from '@/components/auth/user-menu'
import { award as awardXp, useXp, refreshXp } from '@/lib/gamification/use-xp'
import { ChallengeSetup, type ActiveChallenge, type SubmitResult } from '@/components/visualizer/challenge-setup'
import { ChallengeArena } from '@/components/visualizer/challenge-arena'
import { ChallengeResult } from '@/components/visualizer/challenge-result'
import { ChallengeRescue } from '@/components/visualizer/challenge-rescue'
import { ArenaEntry, StakeBurn } from '@/components/visualizer/arena-fx'
import { LeaderboardDialog } from '@/components/visualizer/leaderboard-dialog'
import { ProgressMap } from '@/components/visualizer/progress-map'
import { AiChargeDialog } from '@/components/visualizer/ai-charge-dialog'
import { isTopic, type Difficulty, type Mode, type ChallengeSource, type ChallengeTopic } from '@/lib/visualizer/challenge'
import { ProblemList } from '@/components/visualizer/problem-list'
import { BugList } from '@/components/visualizer/bug-list'
import { PracticeCheck, type CheckResult } from '@/components/visualizer/practice-check'
import { bugById, type BugLevel } from '@/lib/visualizer/bugs'
import { bugFixXp } from '@/lib/gamification/reasons'
import {
  PROBLEM_TOPICS,
  ALL_PROBLEMS,
  CHALLENGE_GATE_PERCENT,
  problemById,
  problemCode,
  type Problem,
  type TopicId,
} from '@/lib/visualizer/problems'
import { Bug, Map as MapIcon, Swords, Trophy } from 'lucide-react'

// Short stable hash of the current program, used to make quiz XP idempotent per
// (program, step) so re-running the same code can't farm repeat XP.
function codeHash(src: string): string {
  let h = 5381
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Which demo teaches which concept — completing (stepping to the end of) one of
// these awards its concept XP, and is the evidence The Path checks for a "see
// it" step. Keys are DEMO_EXAMPLES ids; values must exist in VIZ_CONCEPTS.
const CONCEPT_BY_EXAMPLE: Record<string, string> = {
  conditional: 'conditionals',
  fizzbuzz: 'conditionals',
  'for-loop-sum': 'loops',
  'while-countdown': 'loops',
  'for-of': 'loops',
  'nested-loops': 'loops',
  'array-max': 'arrays',
  'array-mutation': 'arrays',
  'switch-methods': 'array-methods',
  'function-call': 'functions',
  aliasing: 'references',
  destructuring: 'destructuring',
  hoisting: 'hoisting',
  'two-pointer': 'two-pointers',
  recursion: 'recursion',
  closure: 'closures',
  'event-loop': 'event-loop',
  classes: 'oop',
  'bubble-sort': 'sorting',
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

type PanelView =
  | 'memory' | 'heap' | 'callstack' | 'loops' | 'calls'
  | 'eventloop' | 'closures' | 'hoisting' | 'flow' | 'flame'

// Feature tabs (everything except the permanent Memory tab). Each maps to a
// settings flag; enabling the flag pins the tab, closing its "x" turns it off.
const TAB_FEATURES: { view: PanelView; key: FeatureKey; label: string; icon: typeof VariableIcon }[] = [
  { view: 'heap',      key: 'heapGraph',      label: 'Heap graph', icon: NetworkIcon },
  { view: 'callstack', key: 'callStack',      label: 'Call stack', icon: LayersIcon },
  { view: 'loops',     key: 'loopUnroll',     label: 'Loops',      icon: RepeatIcon },
  { view: 'flow',      key: 'flowChart',      label: 'Flow chart', icon: WorkflowIcon },
  { view: 'calls',     key: 'recursionTree',  label: 'Call tree',  icon: GitBranchIcon },
  { view: 'flame',     key: 'flameGraph',     label: 'Flame graph',icon: FlameIcon },
  { view: 'eventloop', key: 'eventLoop',      label: 'Event loop', icon: TimerIcon },
  { view: 'closures',  key: 'closureCapture', label: 'Closures',   icon: LassoIcon },
  { view: 'hoisting',  key: 'hoisting',       label: 'Hoisting',   icon: HoistIcon },
]

const KIND_DESCRIPTION: Record<string, string> = {
  enter:       'Entering a function',
  assign:      'A variable was assigned a new value',
  declare:     'A new variable was declared',
  condition:   'A condition was evaluated (if / else if / while)',
  branch:      'A branch was chosen based on the condition',
  'loop-start':'A loop just started',
  'loop-check':'The loop condition was checked',
  'loop-iter': 'One loop iteration completed',
  'loop-end':  'A loop finished executing',
  read:        'A value was read from an array cell',
  write:       'A value was written to an array cell or object field',
  call:        'A function was called',
  return:      'A function returned',
  output:      'console.log produced output',
  expr:        'An expression was evaluated',
}

const BLANK_CODE = `// Write your JavaScript here, then press Run.

`

function safeInterpret(source: string): { trace: Trace | null; error: string | null; errorLine: number | null } {
  try {
    const trace = interpret(source, { maxSteps: 2000 })
    return { trace, error: null, errorLine: null }
  } catch (e) {
    return {
      trace: null,
      error: e instanceof Error ? e.message : String(e),
      errorLine: e instanceof RuntimeError ? e.line : null,
    }
  }
}

export default function Home() {
  const [code, setCode] = useState<string>(DEMO_EXAMPLES[0].code)
  const initial = useMemo(() => safeInterpret(DEMO_EXAMPLES[0].code), [])
  const [trace, setTrace] = useState<Trace | null>(initial.trace)
  const [error, setError] = useState<string | null>(initial.error)
  const [errorLine, setErrorLine] = useState<number | null>(initial.errorLine)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Signed-in state gates the login-only features (AI tutor, quiz, XP). Guests
  // keep the full visualizer; the extras show a friendly upsell instead.
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)

  // Lab-wide AI language, remembered across sessions. Drives every AI surface.
  const [aiLang, setAiLang] = useState<TutorLang>('bengali')
  useEffect(() => {
    // Hydration-safe: localStorage is only read after mount so SSR and first
    // client render agree. Old 'banglish' preferences map to Bengali.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = window.localStorage.getItem('phi-viz-ai-lang')
      if (saved === 'english') setAiLang('english')
      else if (saved) setAiLang('bengali')
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  const changeAiLang = useCallback((l: TutorLang) => {
    setAiLang(l)
    try { window.localStorage.setItem('phi-viz-ai-lang', l) } catch { /* ignore */ }
  }, [])

  // One-time dismissible guest banner.
  const [guestDismissed, setGuestDismissed] = useState(true)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setGuestDismissed(window.localStorage.getItem('phi-viz-guest-dismissed') === '1')
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  const dismissGuestBanner = useCallback(() => {
    setGuestDismissed(true)
    try { window.localStorage.setItem('phi-viz-guest-dismissed', '1') } catch { /* ignore */ }
  }, [])
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [activeExampleId, setActiveExampleId] = useState(DEMO_EXAMPLES[0].id)

  // ---- Curriculum ----
  // Which catalog problem is open, which topics are expanded, and what the
  // server says is finished. The completed set is server truth (it gates
  // Challenge mode); we only add to it optimistically after a confirmed award.
  const [activeProblemId, setActiveProblemId] = useState<string>(ALL_PROBLEMS[0].id)
  const [openTopics, setOpenTopics] = useState<Set<TopicId>>(new Set([PROBLEM_TOPICS[0].id]))
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [challengeUnlocked, setChallengeUnlocked] = useState(false)
  const [remainingForGate, setRemainingForGate] = useState(0)
  const [gateTopicComplete, setGateTopicComplete] = useState(false)
  const activeProblem = problemById(activeProblemId)

  // ---- Bug Hunt ----
  // A side track, not part of the gate: broken programs to repair. Only one of
  // the two lists drives the editor at a time, so opening a bug clears the
  // active problem and vice versa.
  const [sidebarTab, setSidebarTab] = useState<'problems' | 'bugs'>('problems')
  const [activeBugId, setActiveBugId] = useState('')
  const [bugCompletedIds, setBugCompletedIds] = useState<Set<string>>(new Set())
  const activeBug = activeBugId ? bugById(activeBugId) : undefined

  // Practice / bug check state — shared, since only one can be open.
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [checkBusy, setCheckBusy] = useState(false)

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/labs/js-motion/problems/progress')
      if (!res.ok) return
      const d = await res.json()
      setCompletedIds(new Set<string>(d.completedIds ?? []))
      setProgressPercent(d.percent ?? 0)
      setChallengeUnlocked(!!d.challengeUnlocked)
      setRemainingForGate(d.remainingForGate ?? 0)
      setGateTopicComplete(!!d.gateTopicComplete)
      setBugCompletedIds(new Set<string>(d.bugs?.completedIds ?? []))
    } catch { /* progress is a nicety — never block the lab on it */ }
  }, [])

  useEffect(() => {
    // Signing out clears the board back to the guest view; signing in fetches it.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!signedIn) {
      setProgressPercent(null)
      setCompletedIds(new Set())
      setBugCompletedIds(new Set())
      setChallengeUnlocked(false)
      return
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    void loadProgress()
  }, [signedIn, loadProgress])

  const toggleTopic = useCallback((id: TopicId) => {
    setOpenTopics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const [view, setView] = useState<PanelView>('memory')
  const [barMode, setBarMode] = useState(false)
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set())
  const [floating, setFloating] = useState(false)

  // Opt-in learning features (persisted in localStorage, all off by default).
  const { settings, setFeature, resetAll, enabledCount } = useVisualizerSettings()

  // Quiz state.
  const [quizMode, setQuizMode] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<QuizQuestion | null>(null)
  const [streak, setStreak] = useState(0)
  const answeredRef = useRef<Set<number>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Run the program on the real JS engine (QuickJS) via the trace route instead
  // of the local teaching interpreter. Default ON (the `realEngine` setting), so
  // Run executes every JS language feature exactly like Node. Escape hatches:
  // `?engine=legacy` forces the classic interpreter, `?engine=qjs` forces the real
  // engine regardless of the setting. Explicit Run only — the as-you-type preview
  // stays on the fast local interpreter.
  const realEngineRef = useRef(true)
  const [realEngineBusy, setRealEngineBusy] = useState(false)
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('engine')
      if (q === 'qjs') realEngineRef.current = true
      else if (q === 'legacy') realEngineRef.current = false
      else realEngineRef.current = settings.realEngine
    } catch { realEngineRef.current = settings.realEngine }
  }, [settings.realEngine])

  // Fetch a real-engine trace from the server route (QuickJS sandbox).
  const fetchQjsTrace = useCallback(async (source: string) => {
    const res = await fetch('/api/labs/js-motion/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: source }),
    })
    const data = (await res.json()) as { trace: Trace | null; error: string | null }
    return { trace: data.trace, error: data.error ?? null, errorLine: null as number | null }
  }, [])

  const runQuiet = useCallback((source: string) => {
    const { trace: t, error: err, errorLine: line } = safeInterpret(source)
    // With the real engine as the Run target, the legacy interpreter is only a
    // fast live preview. Its "Unsupported X" / runtime errors are false alarms
    // for valid full-JS code — the real engine (on Run) is the source of truth.
    // Suppress them when the code parses cleanly; genuine syntax errors (acorn)
    // still surface.
    const suppress = err != null && realEngineRef.current && getParseError(source) == null
    setTrace(suppress ? null : t)
    setError(suppress ? null : err)
    setErrorLine(suppress ? null : line)
    setCurrentIndex(0)
    setIsPlaying(false)
    setActiveQuestion(null)
    answeredRef.current = new Set()
  }, [])

  const applyRun = useCallback((t: Trace | null, err: string | null, line: number | null) => {
    setTrace(t)
    setError(err)
    setErrorLine(line)
    setCurrentIndex(0)
    setActiveQuestion(null)
    answeredRef.current = new Set()
    setIsPlaying(!!t && t.steps.length > 1)
  }, [])

  const runAndPlay = useCallback((source: string) => {
    syncCodeToLocation(source)
    if (realEngineRef.current) {
      setRealEngineBusy(true)
      fetchQjsTrace(source)
        .then(({ trace: t, error: err, errorLine: line }) => applyRun(t, err, line))
        .catch((e) => applyRun(null, e instanceof Error ? e.message : String(e), null))
        .finally(() => setRealEngineBusy(false))
      return
    }
    const { trace: t, error: err, errorLine: line } = safeInterpret(source)
    applyRun(t, err, line)
  }, [applyRun, fetchQjsTrace])

  const handleCodeChange = useCallback((value: string) => {
    setCode(value)
    setActiveExampleId('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runQuiet(value), 350)
  }, [runQuiet])

  // Load shared code from the URL on first mount, or the demo The Path sent the
  // learner here to step through (?demo=<DEMO_EXAMPLES id>). Shared code wins:
  // it is the more specific intent.
  useEffect(() => {
    const shared = readCodeFromLocation()
    // Hydration-safe: the URL is only readable on the client, so this must
    // happen in an effect rather than during render / state init.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (shared) {
      setCode(shared)
      setActiveExampleId('')
      setActiveProblemId('')
      runQuiet(shared)
      return
    }
    const params = new URLSearchParams(window.location.search)

    // ?bug=<level id> — a direct link to one Bug Hunt level.
    const wantedBug = params.get('bug')
    const level = wantedBug ? bugById(wantedBug) : undefined
    if (level) {
      setSidebarTab('bugs')
      setActiveBugId(level.id)
      setActiveProblemId('')
      setActiveExampleId('')
      setCode(level.buggyCode)
      runQuiet(level.buggyCode)
      return
    }

    // ?problem=<catalog id> — a direct link to one exercise.
    const wantedProblem = params.get('problem')
    const problem = wantedProblem ? problemById(wantedProblem) : undefined
    if (problem) {
      const source = problemCode(problem)
      setActiveProblemId(problem.id)
      setActiveExampleId(problem.kind === 'demo' ? (problem.demoId ?? '') : '')
      setOpenTopics((prev) => new Set(prev).add(problem.topicId))
      setCode(source)
      runQuiet(source)
      return
    }

    // ?demo=<DEMO_EXAMPLES id> — kept for The Path, which links to demos by
    // their example id rather than the catalog id.
    const wanted = params.get('demo')
    const example = wanted ? DEMO_EXAMPLES.find((ex) => ex.id === wanted) : undefined
    if (example) {
      const owning = ALL_PROBLEMS.find((p) => p.demoId === example.id)
      setCode(example.code)
      setActiveExampleId(example.id)
      if (owning) {
        setActiveProblemId(owning.id)
        setOpenTopics((prev) => new Set(prev).add(owning.topicId))
      }
      runQuiet(example.code)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSteps = trace?.steps.length ?? 0
  const lastIndex = totalSteps - 1

  // Fire confetti when a quiz run finishes on a hot streak — unless the learner
  // prefers reduced motion or has turned on calm mode, in which case we stay
  // quiet.
  const celebrate = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (settings.calmMode) return
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } })
  }, [settings.calmMode])

  // Central "move forward" that respects quiz mode: if the next step is
  // quizzable and unanswered, ask before revealing it.
  const advance = useCallback(() => {
    if (!trace) return
    setCurrentIndex((i) => {
      const next = i + 1
      if (next > lastIndex) {
        setIsPlaying(false)
        return i
      }
      if (quizMode && !answeredRef.current.has(next)) {
        const q = buildQuestion(next, trace)
        if (q) {
          setActiveQuestion(q)
          setIsPlaying(false)
          return i
        }
      }
      if (next >= lastIndex) setIsPlaying(false)
      return next
    })
  }, [trace, lastIndex, quizMode])

  const advanceRef = useRef(advance)
  useEffect(() => {
    advanceRef.current = advance
  })

  // Auto-advance while playing. Key moments (entering a function, resolving a
  // condition) get a little extra dwell at normal speed so the learner can
  // absorb them before the next step — a calmer, more readable pace.
  useEffect(() => {
    if (!isPlaying || !trace) return
    const kind = trace.steps[currentIndex]?.kind
    const dwell = speed <= 1 && (kind === 'enter' || kind === 'condition') ? 1.7 : 1
    const calm = settings.calmMode ? 1.6 : 1
    timerRef.current = setTimeout(() => advanceRef.current(), (700 * dwell * calm) / speed)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPlaying, currentIndex, speed, trace, settings.calmMode])

  // Ambient audio: one soft blip per step, a warm chime at the end. Opt-in and
  // synthesised on the fly (see lib/visualizer/sound). The AudioContext stays
  // suspended until a user gesture, so nothing plays before the learner acts.
  useEffect(() => {
    if (!settings.ambientSound || !trace) return
    const s = trace.steps[currentIndex]
    if (!s) return
    if (currentIndex === lastIndex) playFinishSound()
    else playStepSound(s.kind)
  }, [currentIndex, settings.ambientSound, trace, lastIndex])

  // Finishing a watch-and-learn problem: stepping it all the way to the final
  // step completes it. Two receipts are written, on purpose:
  //   viz_problem — this catalog's progress, and what gates Challenge mode.
  //   viz_concept — the older per-concept receipt. It still drives The Path's
  //                 "see it" steps and the concept badges, so it must keep
  //                 firing even though viz_problem now carries most of the XP.
  // Both are idempotent (a ref guards the session, sourceId guards forever).
  const conceptAwardedRef = useRef<Set<string>>(new Set())
  const problemAwardedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!signedIn || !trace || lastIndex <= 0 || currentIndex !== lastIndex) return

    const concept = CONCEPT_BY_EXAMPLE[activeExampleId]
    if (concept && !conceptAwardedRef.current.has(concept)) {
      conceptAwardedRef.current.add(concept)
      void awardXp('viz_concept', `concept:${concept}`, { concept })
    }

    const problem = problemById(activeProblemId)
    if (problem?.kind === 'demo' && !problemAwardedRef.current.has(problem.id)) {
      problemAwardedRef.current.add(problem.id)
      void awardXp('viz_problem', `problem:${problem.id}`, { problemId: problem.id }).then((r) => {
        if (!r) return
        setCompletedIds((prev) => new Set(prev).add(problem.id))
        // The gate may have just moved — re-read it rather than guessing.
        void loadProgress()
      })
    }
  }, [currentIndex, lastIndex, signedIn, trace, activeExampleId, activeProblemId, loadProgress])

  // Check a practice solution: the server runs it and compares the output.
  const checkPractice = useCallback(async () => {
    const problem = problemById(activeProblemId)
    if (!problem || problem.kind !== 'practice') return
    setCheckBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/problems/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: problem.id, code }),
      })
      const data = (await res.json()) as CheckResult & { error?: string; message?: string }
      if (!res.ok && data?.error) {
        toast.error(data.message ?? 'Could not check your solution')
        return
      }
      setCheckResult(data)
      if (data.passed) {
        setCompletedIds((prev) => new Set(prev).add(problem.id))
        void refreshXp()
        void loadProgress()
        if (data.xpGained) {
          toast.success(`Solved — +${data.xpGained} XP`)
          celebrate()
        }
      }
    } catch {
      toast.error('Could not check your solution')
    } finally {
      setCheckBusy(false)
    }
  }, [activeProblemId, code, loadProgress, celebrate])

  // Check a Bug Hunt fix. Same contract as the practice check, different route
  // and answer key.
  const checkBug = useCallback(async () => {
    const level = activeBugId ? bugById(activeBugId) : undefined
    if (!level) return
    setCheckBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/bugs/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugId: level.id, code }),
      })
      const data = (await res.json()) as CheckResult & { error?: string; message?: string }
      if (!res.ok && data?.error) {
        toast.error(data.message ?? 'Could not check your fix')
        return
      }
      setCheckResult(data)
      if (data.passed) {
        setBugCompletedIds((prev) => new Set(prev).add(level.id))
        void refreshXp()
        void loadProgress()
        if (data.xpGained) {
          toast.success(`Bug squashed — +${data.xpGained} XP`)
          celebrate()
        }
      }
    } catch {
      toast.error('Could not check your fix')
    } finally {
      setCheckBusy(false)
    }
  }, [activeBugId, code, loadProgress, celebrate])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Resolve a quiz answer and continue.
  const resolveQuiz = useCallback((correct: boolean) => {
    const q = activeQuestion
    setActiveQuestion(null)
    if (!q) return
    answeredRef.current.add(q.stepIndex)
    setStreak((s) => {
      const ns = correct ? s + 1 : 0
      // Award XP for a correct answer. sourceId is derived from the code so the
      // same step in the same program can't be farmed for repeat XP.
      if (correct) {
        void awardXp('quiz_correct', `${codeHash(code)}:${q.stepIndex}`, { streak: ns })
      }
      return ns
    })
    setCurrentIndex(q.stepIndex)
    if (q.stepIndex >= lastIndex && correct) {
      setTimeout(celebrate, 150)
    }
  }, [activeQuestion, lastIndex, celebrate, code])

  const currentStep: Step | undefined = trace?.steps[currentIndex]
  const previousStep: Step | undefined = trace?.steps[currentIndex - 1]

  // Guests can't use quiz mode (XP needs an account) — turn it off if the
  // session flips to signed-out while quiz was on.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!signedIn && quizMode) {
      setQuizMode(false)
      setActiveQuestion(null)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [signedIn, quizMode])

  // Lazily build the AI-tutor request for the current step (primitive locals of
  // the innermost frame give the model concrete values to talk about).
  const buildStepRequest = useCallback((): TutorRequest => {
    const top = currentStep?.frames[currentStep.frames.length - 1]
    const vars = top?.vars
      .filter((v) => !v.closure && v.value.t === 'prim')
      .map((v) => {
        const p = v.value.t === 'prim' ? v.value.v : undefined
        const s = p === null ? 'null' : p === undefined ? 'undefined' : typeof p === 'string' ? `"${p}"` : String(p)
        return `${v.name} = ${s}`
      })
      .slice(0, 10)
      .join(', ')
    return {
      mode: 'step',
      code,
      step: {
        description: currentStep?.description,
        kind: currentStep?.kind,
        line: currentStep?.line,
        vars,
      },
    }
  }, [code, currentStep])

  const buildErrorRequest = useCallback((): TutorRequest => ({ mode: 'error', code, error: error ?? '' }), [code, error])

  const heap = useMemo(() => heapMap(currentStep?.heap ?? []), [currentStep])

  // Changed variable signatures (frameName:varName) vs the previous step.
  const changedVars = useMemo(() => {
    const changed = new Set<string>()
    if (!currentStep || !previousStep) return changed
    const sig = (frameName: string, name: string, v: string) => `${frameName}:${name}=${v}`
    const prev = new Map<string, string>()
    for (const f of previousStep.frames) {
      for (const v of f.vars) prev.set(`${f.name}:${v.name}`, JSON.stringify(v.value))
    }
    for (const f of currentStep.frames) {
      for (const v of f.vars) {
        const key = `${f.name}:${v.name}`
        const now = JSON.stringify(v.value)
        if (prev.get(key) !== now) changed.add(key)
      }
    }
    void sig
    return changed
  }, [currentStep, previousStep])

  // Index-pointer markers: arrayName -> (cellIndex -> [indexVarNames]).
  const indexPointers = useMemo(() => {
    const out = new Map<string, Map<number, string[]>>()
    if (!trace || !currentStep) return out
    // Gather every numeric variable currently in scope (top frame wins).
    const numeric = new Map<string, number>()
    for (const f of currentStep.frames) {
      for (const v of f.vars) {
        if (v.value.t === 'prim' && typeof v.value.v === 'number' && Number.isInteger(v.value.v)) {
          numeric.set(v.name, v.value.v)
        }
      }
    }
    for (const f of currentStep.frames) {
      for (const v of f.vars) {
        if (v.value.t !== 'ref') continue
        const h = heap.get(v.value.id)
        if (!h || h.kind !== 'array') continue
        const idxNames = trace.indexVars[v.name]
        if (!idxNames) continue
        const cellMap = new Map<number, string[]>()
        for (const idxName of idxNames) {
          const val = numeric.get(idxName)
          if (val === undefined || val < 0 || val >= (h.cells?.length ?? 0)) continue
          const arr = cellMap.get(val) ?? []
          arr.push(idxName)
          cellMap.set(val, arr)
        }
        if (cellMap.size > 0) out.set(v.name, cellMap)
      }
    }
    return out
  }, [trace, currentStep, heap])

  const outputsSoFar = useMemo(() => {
    if (!trace) return [] as string[]
    const out: string[] = []
    for (let i = 0; i <= currentIndex; i++) {
      const s = trace.steps[i]
      if (s.kind === 'output' && s.output != null) out.push(s.output)
    }
    return out
  }, [trace, currentIndex])

  // ---- opt-in feature derivations (cheap; computed once per trace/step) ----
  const loops = useMemo(() => (trace ? buildLoops(trace) : []), [trace])
  const currentLoop = useMemo(() => activeLoop(loops, currentIndex), [loops, currentIndex])
  const callTree = useMemo(
    () => (trace ? buildCallTree(trace) : { roots: [], totalCalls: 0 }),
    [trace],
  )
  const currentCallId = useMemo(
    () => activeCallId(callTree.roots, currentIndex),
    [callTree, currentIndex],
  )
  const laneEntries = useMemo(
    () => (trace ? consoleEntries(trace, currentIndex) : []),
    [trace, currentIndex],
  )

  const seek = useCallback((idx: number) => { setIsPlaying(false); setCurrentIndex(idx) }, [])

  // Which panel tabs are available depends on enabled features.
  const panelTabs = useMemo(() => {
    const tabs: { id: PanelView; key?: FeatureKey; label: string; icon: typeof VariableIcon }[] = [
      { id: 'memory', label: 'Memory', icon: VariableIcon },
    ]
    for (const f of TAB_FEATURES) {
      if (settings[f.key]) tabs.push({ id: f.view, key: f.key, label: f.label, icon: f.icon })
    }
    return tabs
  }, [settings])

  // Tab-features not currently pinned — offered by the "+" menu.
  const addableTabs = useMemo(() => TAB_FEATURES.filter((f) => !settings[f.key]), [settings])

  // If the active tab's feature was turned off, transparently fall back to
  // Memory without a state write (avoids a cascading-render effect).
  const effectiveView: PanelView = panelTabs.some((t) => t.id === view) ? view : 'memory'

  // Build the editor's execution highlight from the current step.
  const editorHighlight = useMemo<EditorHighlight | null>(() => {
    if (!currentStep) return null
    // Ghost text: primitive locals of the innermost frame.
    const top = currentStep.frames[currentStep.frames.length - 1]
    const ghostParts: string[] = []
    if (top) {
      for (const v of top.vars) {
        if (v.closure) continue
        if (v.value.t === 'prim') {
          const p = v.value.v
          const s = p === null ? 'null' : p === undefined ? 'undefined' : typeof p === 'string' ? `"${p}"` : String(p)
          ghostParts.push(`${v.name} = ${s}`)
        }
      }
    }
    const signature = currentStep.bindings?.map((b) => `${b.name} = ${b.value}`).join(' · ')
    return {
      activeLine: currentStep.line,
      kind: currentStep.kind,
      fnStart: currentStep.fnLoc?.line,
      fnEnd: currentStep.fnLoc?.endLine,
      callLine: currentStep.callLine,
      ghostText: ghostParts.length > 0 ? ghostParts.slice(0, 6).join('  ·  ') : undefined,
      signatureText: signature,
      dimInactive: settings.focusDim && isPlaying,
    }
  }, [currentStep, settings.focusDim, isPlaying])

  const handleBugClick = useCallback((b: BugLevel) => {
    setActiveBugId(b.id)
    setActiveProblemId('')
    setActiveExampleId('')
    setCheckResult(null)
    setCode(b.buggyCode)
    runQuiet(b.buggyCode)
  }, [runQuiet])

  const handleProblemClick = useCallback((p: Problem) => {
    const source = problemCode(p)
    setActiveBugId('')
    setActiveProblemId(p.id)
    // Demo problems are backed by a DEMO_EXAMPLES entry — keep that id in sync so
    // the concept award and The Path's ?demo= deep link still line up. Practice
    // problems have no example behind them.
    setActiveExampleId(p.kind === 'demo' ? (p.demoId ?? '') : '')
    setCheckResult(null)
    setCode(source)
    runQuiet(source)
  }, [runQuiet])

  const handleNewClick = () => {
    setActiveExampleId('')
    setActiveProblemId('')
    setActiveBugId('')
    setCheckResult(null)
    setCode(BLANK_CODE)
    runQuiet(BLANK_CODE)
  }

  // A one-off ripple pulse into the editor on Run (E2), keyed to retrigger.
  const [runPulse, setRunPulse] = useState(0)
  const handleRunClick = useCallback(() => {
    // Unlock the audio context inside this click so the first step's blip isn't
    // swallowed by the browser autoplay policy.
    if (settings.ambientSound) unlockAudio()
    // Daily practice XP — idempotent per calendar day on the server.
    if (signedIn) void awardXp('viz_daily', todayUTC())
    if (!settings.calmMode) setRunPulse((n) => n + 1)
    runAndPlay(code)
  }, [code, runAndPlay, settings.ambientSound, settings.calmMode, signedIn])

  // Load an AI-generated challenge program into the editor and run it.
  const handleUseChallenge = useCallback((newCode: string) => {
    setActiveExampleId('')
    setCode(newCode)
    runAndPlay(newCode)
  }, [runAndPlay])

  // ---- Challenge Mode ----
  const { xp: userXp } = useXp()
  const [challengePhase, setChallengePhase] = useState<'off' | 'setup' | 'arena'>('off')
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null)
  const [challengeResult, setChallengeResult] = useState<SubmitResult | null>(null)
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [challengeDifficulty, setChallengeDifficulty] = useState<Difficulty>('easy')
  const [challengeMode, setChallengeMode] = useState<Mode>('oneshot')
  const [challengeSource, setChallengeSource] = useState<ChallengeSource>('code')
  const [challengeTopics, setChallengeTopics] = useState<ChallengeTopic[]>([])
  // Arena entry FX (flame wipe + countdown) overlays the arena on activate.
  const [challengeEntering, setChallengeEntering] = useState(false)
  // Weekly rank captured on entry, so a win can announce a rank-up (C4).
  const prevRankRef = useRef<number | null>(null)
  // A Blitz rescue prompt: 'time' (clock out) or 'life' (tries out). null = none.
  const [rescue, setRescue] = useState<{ kind: 'time' | 'life' } | null>(null)
  const challengeActive = challengePhase === 'arena'
  const hasRealCode = code.replace(/\/\/.*$/gm, '').trim().length > 0

  // Remember the last topic selection across sessions.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const t = window.localStorage.getItem('phi-viz-ch-topics')
      if (t) { const arr = JSON.parse(t); if (Array.isArray(arr)) setChallengeTopics(arr.filter(isTopic)) }
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  useEffect(() => {
    try { window.localStorage.setItem('phi-viz-ch-topics', JSON.stringify(challengeTopics)) } catch { /* ignore */ }
  }, [challengeTopics])

  // Hint state (one per round).
  const [challengeHint, setChallengeHint] = useState<string | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)

  // Leaderboard dialog.
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  // Jumping from the map: the target may live behind the other sidebar tab, so
  // switch to it — otherwise the editor and the sidebar disagree about what the
  // learner is looking at.
  const jumpToProblem = useCallback((p: Problem) => {
    setSidebarTab('problems')
    setOpenTopics((prev) => new Set(prev).add(p.topicId))
    handleProblemClick(p)
  }, [handleProblemClick])

  const jumpToBug = useCallback((b: BugLevel) => {
    setSidebarTab('bugs')
    handleBugClick(b)
  }, [handleBugClick])

  // AI-charge confirm. Remembered "don't show again" in localStorage.
  const [aiChargeAck, setAiChargeAck] = useState(false)
  const [aiChargeOpen, setAiChargeOpen] = useState(false)
  const aiResolveRef = useRef<((v: boolean) => void) | null>(null)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try { if (window.localStorage.getItem('phi-viz-ai-charge-ack') === '1') setAiChargeAck(true) } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Gate every helper-AI action: block if too poor, confirm once (unless acked).
  const requestAiCharge = useCallback(async (): Promise<boolean> => {
    if (!signedIn) return true
    if (userXp < 30) { toast.error('You need 30 XP for AI help'); return false }
    if (aiChargeAck) { setTimeout(() => void refreshXp(), 2500); return true }
    return new Promise<boolean>((resolve) => {
      aiResolveRef.current = (ok: boolean) => { if (ok) setTimeout(() => void refreshXp(), 2500); resolve(ok) }
      setAiChargeOpen(true)
    })
  }, [signedIn, userXp, aiChargeAck])

  const buyHint = useCallback(async () => {
    setHintBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/challenge/hint', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message || 'Could not get a hint'); return }
      setChallengeHint(data.hint)
      setHintUsed(true)
      void refreshXp()
    } catch {
      toast.error('Could not get a hint')
    } finally {
      setHintBusy(false)
    }
  }, [])

  // Resume an in-progress challenge after a refresh. A Blitz round that came
  // back rescuable was mid-offer when the page went away — re-open the offer
  // rather than the arena, so a reload doesn't quietly cost the stake.
  useEffect(() => {
    if (!signedIn) return
    let alive = true
    fetch('/api/labs/js-motion/challenge/active')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.active) {
          setChallenge(d.active as ActiveChallenge)
          setChallengePhase('arena')
          setHintUsed((d.active.hintsUsed ?? 0) > 0)
          if (d.rescuable === 'time' || d.rescuable === 'life') setRescue({ kind: d.rescuable })
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [signedIn])

  const openChallenge = useCallback(() => {
    setChallengeResult(null)
    setRescue(null)
    // Smart default: base it on the editor's code when there is real code, else topics.
    setChallengeSource(code.replace(/\/\/.*$/gm, '').trim() ? 'code' : 'topics')
    setChallengePhase('setup')
  }, [code])
  const closeChallenge = useCallback(() => { setChallengePhase('off'); setChallenge(null); setChallengeResult(null); setRescue(null) }, [])

  const activateChallenge = useCallback(async () => {
    setChallengeBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/challenge/activate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ difficulty: challengeDifficulty, mode: challengeMode, lang: aiLang, source: challengeSource, topics: challengeTopics, code }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message || 'Could not start the challenge'); return }
      const ch = data as ActiveChallenge
      setChallenge(ch)
      setChallengePhase('arena')
      setChallengeEntering(true) // play the flame-wipe + countdown once
      setChallengeResult(null)
      setChallengeHint(null)
      setHintUsed(false)
      setActiveExampleId('')
      const header = ch.signature ? `function ${ch.signature} {` : `function ${ch.fnName}() {`
      const stub = `// Write your solution. It must return its result.\n${header}\n  \n}\n`
      setCode(stub)
      runQuiet(stub)
      void refreshXp()
      // Baseline this week's rank so a win can announce a rank-up.
      fetch('/api/labs/js-motion/leaderboard')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { prevRankRef.current = d?.you?.rank ?? null })
        .catch(() => {})
    } catch {
      toast.error('Could not start the challenge')
    } finally {
      setChallengeBusy(false)
    }
  }, [challengeDifficulty, challengeMode, challengeSource, challengeTopics, aiLang, code, runQuiet])

  const submitChallenge = useCallback(async () => {
    if (!challenge) return
    setChallengeBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/challenge/submit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId: challenge.attemptId, code }),
      })
      const data = (await res.json()) as SubmitResult & { message?: string }
      if (!res.ok) { toast.error(data?.message || 'Submit failed'); return }
      void refreshXp()
      // Blitz rescue — clock out (buy time) or tries out (buy a life). Offer the
      // purchase instead of a loss; the round stays live server-side.
      if (data.status === 'rescue' && data.rescuable) {
        if (data.rescuable === 'life') setChallenge((c) => (c ? { ...c, attemptsUsed: c.maxAttempts } : c))
        setRescue({ kind: data.rescuable })
        return
      }
      setChallengeResult(data)
      // Win celebration (flash / confetti / count-up) is staged inside
      // ChallengeResult so it's synced with the overlay.
      if (data.status === 'active') {
        setChallenge((c) => (c ? { ...c, attemptsUsed: c.attemptsUsed + 1 } : c))
      } else if (data.status === 'won') {
        // Rank-up toast — announce only if the weekly rank actually improved.
        fetch('/api/labs/js-motion/leaderboard')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const nr: number | null = d?.you?.rank ?? null
            const pr = prevRankRef.current
            prevRankRef.current = nr
            if (nr && (pr === null || nr < pr)) {
              setTimeout(() => toast.success(pr && pr !== nr ? `Rank up! #${pr} → #${nr} this week` : `You're #${nr} this week`, { icon: '🏆' }), 1500)
            }
          })
          .catch(() => {})
      }
    } catch {
      toast.error('Submit failed')
    } finally {
      setChallengeBusy(false)
    }
  }, [challenge, code])

  const giveUpChallenge = useCallback(async () => {
    if (!challenge) return
    setChallengeBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/challenge/giveup', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId: challenge.attemptId }),
      })
      const data = await res.json()
      void refreshXp()
      setRescue(null)
      setChallengeResult({ status: 'lost', passed: 0, total: 0, xpDelta: 0, balance: data?.balance ?? userXp, reason: 'giveup' })
    } catch {
      toast.error('Could not give up')
    } finally {
      setChallengeBusy(false)
    }
  }, [challenge, userXp])

  // Buy a Blitz rescue (extend the clock, or a fresh life) and stay in the round.
  const resumeChallenge = useCallback(async () => {
    if (!challenge || !rescue) return
    setChallengeBusy(true)
    try {
      const res = await fetch('/api/labs/js-motion/challenge/resume', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId: challenge.attemptId, kind: rescue.kind }),
      })
      const data = await res.json()
      void refreshXp()
      if (!res.ok) {
        // If the clock ran out while deciding on a life, fall back to a time resume.
        if (data?.error === 'EXPIRED') { setRescue({ kind: 'time' }); return }
        toast.error(data?.message || 'Could not resume')
        return
      }
      setChallenge((c) => (c ? {
        ...c,
        expiresAt: data.expiresAt ?? c.expiresAt,
        maxAttempts: data.maxAttempts ?? c.maxAttempts,
        attemptsUsed: data.attemptsUsed ?? c.attemptsUsed,
      } : c))
      setRescue(null)
      setChallengeResult(null)
      if (settings.ambientSound) playGoSting()
    } catch {
      toast.error('Could not resume')
    } finally {
      setChallengeBusy(false)
    }
  }, [challenge, rescue, settings.ambientSound])

  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }, [])

  const breakpointLines = breakpoints

  const continueToBreakpoint = useCallback(() => {
    if (!trace) return
    setIsPlaying(false)
    for (let i = currentIndex + 1; i <= lastIndex; i++) {
      if (breakpoints.has(trace.steps[i].line)) {
        setCurrentIndex(i)
        return
      }
    }
    setCurrentIndex(lastIndex)
  }, [trace, currentIndex, lastIndex, breakpoints])

  const handleShare = useCallback(async () => {
    try {
      const url = encodeCodeToUrl(code)
      await navigator.clipboard.writeText(url)
      window.history.replaceState(null, '', url)
      toast.success('Share link copied to clipboard')
    } catch {
      toast.error('Could not copy the share link')
    }
  }, [code])

  // Keyboard shortcuts (ignored while typing in the editor).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.closest('.cm-editor') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (activeQuestion) return
      if (e.key === 'ArrowRight') { e.preventDefault(); setIsPlaying(false); advanceRef.current() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIsPlaying(false); setCurrentIndex((i) => Math.max(0, i - 1)) }
      else if (e.key === ' ') {
        e.preventDefault()
        if (!trace || trace.steps.length === 0) return
        setCurrentIndex((i) => (i >= lastIndex ? 0 : i))
        setIsPlaying((p) => !p)
      }
      else if (e.key === 'Home') { e.preventDefault(); setIsPlaying(false); setCurrentIndex(0) }
      else if (e.key === 'End') { e.preventDefault(); setIsPlaying(false); setCurrentIndex(lastIndex) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [trace, lastIndex, activeQuestion])

  // ---- Step description banner with expression breakdown ----
  // The amber container stays mounted; only its content crossfades between steps.
  const stepBanner = currentStep && (
    <div className="shrink-0 min-h-16">
      <div className="rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/60 p-2.5 shadow-sm overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
            className="flex items-center gap-3"
          >
            <div className="h-7 w-7 rounded-full bg-amber-500 dark:bg-amber-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {currentIndex + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{currentStep.kind}</Badge>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {KIND_DESCRIPTION[currentStep.kind]}
                </span>
                {currentStep.conditionResult !== undefined && (
                  <span className={cn(
                    'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold',
                    currentStep.conditionResult ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white',
                  )}>
                    {currentStep.conditionResult ? 'TRUE' : 'FALSE'}
                  </span>
                )}
                {currentStep.iteration !== undefined && (
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 font-mono">
                    iter #{currentStep.iteration}
                  </span>
                )}
                {settings.aiTutor && !sessionPending && !challengeActive && (
                  <div className="ml-auto">
                    <AiTutor
                      getRequest={buildStepRequest}
                      resetKey={currentIndex}
                      lang={aiLang}
                      locked={!signedIn}
                      variant="why"
                      onBeforeAi={requestAiCharge}
                    />
                  </div>
                )}
              </div>
              {currentStep.exprTrail && currentStep.exprTrail.length > 1 ? (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {currentStep.exprTrail.map((stage, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.18, duration: 0.2 }}
                      className="flex items-center gap-1.5"
                    >
                      {i > 0 && <span className="text-amber-500">→</span>}
                      <code className={cn(
                        'font-mono text-[12px] px-1.5 py-0.5 rounded',
                        i === currentStep.exprTrail!.length - 1
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-amber-100 dark:bg-amber-900/50 text-amber-950 dark:text-amber-200',
                      )}>
                        {stage}
                      </code>
                    </motion.span>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[12px] mt-0.5 text-amber-950 dark:text-amber-300 wrap-break-word leading-snug">
                  {currentStep.description}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )

  const anyNumericArray = useMemo(() => {
    if (!currentStep) return false
    for (const f of currentStep.frames) {
      for (const v of f.vars) {
        if (v.value.t === 'ref') {
          const h = heap.get(v.value.id)
          if (h?.kind === 'array' && (h.cells ?? []).every((c) => c.t === 'prim' && typeof c.v === 'number')) {
            return true
          }
        }
      }
    }
    return false
  }, [currentStep, heap])

  // ---- Memory / Heap / feature panel ----
  const visualPanel = (
    <section className="relative rounded-xl border-2 border-border bg-card overflow-hidden shadow-sm flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-1 px-2 py-2 border-b bg-muted/50 shrink-0 overflow-x-auto">
        {panelTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = effectiveView === tab.id
          return (
            <div
              key={tab.id}
              className={cn(
                'group relative flex items-center gap-1 rounded-md pr-1 whitespace-nowrap',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground transition-colors',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="jsm-tab-pill"
                  transition={settings.calmMode ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 z-0 rounded-md bg-background shadow-sm"
                />
              )}
              <button
                onClick={() => setView(tab.id)}
                className="relative z-10 flex items-center gap-1.5 text-sm font-semibold px-2 py-1"
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
              {tab.key && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFeature(tab.key!, false) }}
                  title={`Close ${tab.label}`}
                  className="relative z-10 rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
        {addableTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Add a feature tab"
                className="flex items-center rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground shrink-0"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {addableTabs.map((f) => {
                const Icon = f.icon
                return (
                  <DropdownMenuItem
                    key={f.key}
                    onSelect={() => { setFeature(f.key, true); setView(f.view) }}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" /> {f.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
          {effectiveView === 'memory' && anyNumericArray && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <BarChart3 className="h-3.5 w-3.5" />
              bars
              <Switch checked={barMode} onCheckedChange={setBarMode} size="sm" />
            </label>
          )}
          {!floating && (
            <button
              onClick={() => setFloating(true)}
              title="Pop out into a floating window"
              className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <PopOutIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {effectiveView === 'memory' && (
          <div className="h-full overflow-y-auto p-2.5">
            <MemoryPanel
              step={currentStep}
              heap={heap}
              changed={changedVars}
              indexPointers={indexPointers}
              barMode={barMode}
              aliasWires={settings.aliasWires}
            />
          </div>
        )}
        {effectiveView === 'heap' && <HeapGraph step={currentStep} />}
        {effectiveView === 'callstack' && <CallStackPanel step={currentStep} />}
        {effectiveView === 'flame' && (
          <FlameGraph steps={trace?.steps ?? []} currentIndex={currentIndex} onSeek={seek} />
        )}
        {effectiveView === 'loops' && <LoopUnroll loop={currentLoop} currentIndex={currentIndex} onJump={seek} />}
        {effectiveView === 'calls' && (
          <RecursionTree
            roots={callTree.roots}
            totalCalls={callTree.totalCalls}
            currentIndex={currentIndex}
            activeId={currentCallId}
            onJump={seek}
          />
        )}
        {effectiveView === 'flow' && <FlowChart trace={trace} currentIndex={currentIndex} onJump={seek} />}
        {effectiveView === 'eventloop' && <EventLoopPanel async={currentStep?.async} />}
        {effectiveView === 'closures' && <ClosureCapture step={currentStep} />}
        {effectiveView === 'hoisting' && <HoistingPanel hoisting={trace?.hoisting} step={currentStep} />}
      </div>
      {settings.diffFlash && (
        <DiffFlash currentStep={currentStep} previousStep={previousStep} stepIndex={currentIndex} />
      )}
    </section>
  )

  const consolePanel = (
    <section className="rounded-xl border-2 border-border bg-card overflow-hidden shadow-sm flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 shrink-0">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Console output</span>
        {settings.consoleLane && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            lane
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{outputsSoFar.length} line(s)</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-200 dark:bg-zinc-900 p-2.5">
        {settings.consoleLane ? (
          <ConsoleLane entries={laneEntries} currentIndex={currentIndex} onJump={seek} />
        ) : outputsSoFar.length === 0 ? (
          <div className="text-sm text-slate-500 italic text-center py-6 font-mono">
            console output will appear here
          </div>
        ) : (
          <div className="font-mono text-[13px] space-y-0.5">
            <AnimatePresence initial={false}>
              {outputsSoFar.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="text-emerald-700 dark:text-emerald-300 flex gap-2"
                >
                  <span className="text-slate-500 select-none">›</span>
                  <span className="break-all whitespace-pre-wrap">{line}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  )

  const timelinePanel = trace && trace.steps.length > 0 ? (
    <section className="rounded-xl border-2 border-border bg-card overflow-hidden shadow-sm shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
        <span className="text-sm font-semibold">Timeline</span>
        <span className="ml-auto text-[11px] text-muted-foreground">click any step to jump</span>
      </div>
      <div className="p-2">
        <Timeline
          steps={trace.steps}
          currentIndex={currentIndex}
          onSeek={(idx) => { setIsPlaying(false); setCurrentIndex(idx) }}
          breakpointLines={breakpointLines}
        />
        {settings.heatTrail && (
          <HeatTrail
            steps={trace.steps}
            currentIndex={currentIndex}
            onSeek={(idx) => { setIsPlaying(false); setCurrentIndex(idx) }}
          />
        )}
        <div className="mt-1.5 pt-1.5 border-t">
          <StepLegend />
        </div>
      </div>
    </section>
  ) : null

  return (
    <div className={cn(
      'relative h-screen flex flex-col overflow-hidden transition-colors',
      challengeActive
        ? 'bg-linear-to-br from-rose-100 via-orange-50 to-rose-100 dark:from-rose-950 dark:via-zinc-950 dark:to-orange-950 ring-4 ring-inset ring-rose-500/40'
        : 'bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950',
    )}>
      <Toaster position="top-center" />
      {challengeEntering && (
        <>
          <ArenaEntry calm={settings.calmMode} sound={settings.ambientSound} onDone={() => setChallengeEntering(false)} />
          {challenge && <StakeBurn stake={challenge.stake} calm={settings.calmMode} />}
        </>
      )}
      {challengeResult && challengeResult.status !== 'active' && (
        <ChallengeResult
          result={challengeResult}
          stake={challenge?.stake ?? 0}
          calm={settings.calmMode}
          sound={settings.ambientSound}
          onNew={() => { setChallengeResult(null); setChallenge(null); setChallengeHint(null); setHintUsed(false); setChallengePhase('setup') }}
          onExit={closeChallenge}
        />
      )}
      {rescue && !challengeResult && (
        <ChallengeRescue
          kind={rescue.kind}
          xp={userXp}
          busy={challengeBusy}
          calm={settings.calmMode}
          onBuy={resumeChallenge}
          onDecline={giveUpChallenge}
        />
      )}
      <LeaderboardDialog open={leaderboardOpen} onOpenChange={setLeaderboardOpen} />
      <ProgressMap
        open={mapOpen}
        onOpenChange={setMapOpen}
        completedIds={completedIds}
        bugCompletedIds={bugCompletedIds}
        percent={progressPercent}
        challengeUnlocked={challengeUnlocked}
        gatePercent={CHALLENGE_GATE_PERCENT}
        signedIn={signedIn}
        onPickProblem={jumpToProblem}
        onPickBug={jumpToBug}
        onOpenChallenge={openChallenge}
      />
      <AiChargeDialog
        open={aiChargeOpen}
        balance={userXp}
        onConfirm={(dontShow) => {
          setAiChargeOpen(false)
          if (dontShow) { setAiChargeAck(true); try { window.localStorage.setItem('phi-viz-ai-charge-ack', '1') } catch { /* ignore */ } }
          aiResolveRef.current?.(true); aiResolveRef.current = null
        }}
        onCancel={() => { setAiChargeOpen(false); aiResolveRef.current?.(false); aiResolveRef.current = null }}
      />
      {floating && (
        <FloatingWindow title="Visual panel" onDock={() => setFloating(false)}>
          {visualPanel}
        </FloatingWindow>
      )}
      <header className="border-b bg-background/80 backdrop-blur-sm shrink-0">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 flex items-center justify-center shadow-md">
              <Zap className="h-5 w-5 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Js Motion Lab</h1>
              <p className="text-xs text-muted-foreground leading-tight">Step-by-step JavaScript visualizer</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <label className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mr-1">
                <GraduationCap className="h-4 w-4" />
                Quiz
                <Switch checked={quizMode} onCheckedChange={(v) => { setQuizMode(v); if (!v) setActiveQuestion(null); setStreak(0) }} size="sm" />
              </label>
            ) : !sessionPending && (
              <Link
                href="/sign-in?next=/labs/js-motion"
                title="Sign in to unlock quizzes & XP"
                className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mr-1"
              >
                <Lock className="h-3.5 w-3.5" />
                Quiz
              </Link>
            )}
            <SettingsPanel
              settings={settings}
              onToggle={setFeature}
              onReset={resetAll}
              enabledCount={enabledCount}
              labLang={aiLang}
              onLangChange={changeAiLang}
            />
            <AnimatedThemeToggler />
            {signedIn && (
              <>
                <XpHint />
                <span id="js-motion-xp-anchor" className="inline-flex">
                  <XpBadge />
                </span>
              </>
            )}
            <Button variant="secondary" className="hidden sm:flex rounded-full">
              <Cpu className="mr-1" />
              {trace ? `${trace.steps.length} steps` : '— steps'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} title="Copy a shareable link">
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleNewClick} title="Open a blank editor for your own code">
              <FilePlus2 className="h-4 w-4 mr-1" />
              New
            </Button>
            {/* Guests get this too — the map is where the curriculum makes sense
                as a whole, so it's the most honest place to show what signing in
                is actually for. */}
            {!challengeActive && (
              <Button variant="outline" size="sm" onClick={() => setMapOpen(true)} title="Your progress map" className="hidden sm:flex">
                <MapIcon className="h-4 w-4 sm:mr-1 text-pink-500" />
                <span className="hidden md:inline">Map</span>
              </Button>
            )}
            {signedIn && !challengeActive && (
              <Button variant="outline" size="sm" onClick={() => setLeaderboardOpen(true)} title="Weekly leaderboard" className="hidden sm:flex">
                <Trophy className="h-4 w-4 sm:mr-1 text-amber-500" />
                <span className="hidden md:inline">Ranks</span>
              </Button>
            )}
            {challengePhase === 'off' && !sessionPending && (
              <Button
                variant="outline"
                size="sm"
                onClick={openChallenge}
                title={
                  !signedIn
                    ? 'Sign in to take a staked challenge'
                    : challengeUnlocked
                      ? 'Stake XP and take an AI coding challenge'
                      : `Unlocks at ${Math.round(CHALLENGE_GATE_PERCENT * 100)}% of the problems plus the Functions topic`
                }
                className={cn(
                  'border-rose-400/60 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10',
                  signedIn && !challengeUnlocked && 'opacity-60',
                )}
              >
                {signedIn && !challengeUnlocked
                  ? <Lock className="h-4 w-4 mr-1" />
                  : <Swords className="h-4 w-4 mr-1" />}
                Challenge
              </Button>
            )}
            <Button variant="default" className='bg-linear-to-r from-pink-500 to-red-500' size="sm" onClick={handleRunClick} disabled={realEngineBusy}>
              <Play className="h-4 w-4 mr-1" />
              {realEngineBusy ? 'Running…' : 'Run'}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      {!signedIn && !sessionPending && !guestDismissed && (
        <div className="shrink-0 border-b border-violet-500/20 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-transparent">
          <div className="px-4 py-2 flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
            <p className="text-xs text-foreground/80 leading-snug">
              You&apos;re exploring as a guest — everything here is open. <strong className="text-foreground">Sign in free</strong> to also unlock the AI tutor, quizzes and XP. No pressure!
            </p>
            <Link
              href="/sign-in?next=/labs/js-motion"
              className="ml-auto shrink-0 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Sign in
            </Link>
            <button
              onClick={dismissGuestBanner}
              title="Continue as guest"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 p-3">
        <ResizablePanelGroup orientation="horizontal" className="h-full gap-3">
          <ResizablePanel defaultSize={18} minSize={14} className="min-w-0">
            {challengePhase === 'setup' ? (
              <ChallengeSetup
                xp={userXp}
                locked={!signedIn}
                busy={challengeBusy}
                hasCode={hasRealCode}
                calm={settings.calmMode}
                sound={settings.ambientSound}
                gateUnlocked={challengeUnlocked}
                gateRemaining={remainingForGate}
                gateTopicComplete={gateTopicComplete}
                gatePercent={CHALLENGE_GATE_PERCENT}
                difficulty={challengeDifficulty}
                mode={challengeMode}
                source={challengeSource}
                topics={challengeTopics}
                onChange={(n) => {
                  if (n.difficulty) setChallengeDifficulty(n.difficulty)
                  if (n.mode) setChallengeMode(n.mode)
                  if (n.source) setChallengeSource(n.source)
                  if (n.topics) setChallengeTopics(n.topics)
                }}
                onActivate={activateChallenge}
                onClose={closeChallenge}
              />
            ) : challengePhase === 'arena' && challenge ? (
              <ChallengeArena
                challenge={challenge}
                busy={challengeBusy}
                lastResult={challengeResult && challengeResult.status === 'active' ? challengeResult : null}
                hint={challengeHint}
                hintBusy={hintBusy}
                hintUsed={hintUsed}
                calm={settings.calmMode}
                sound={settings.ambientSound}
                onHint={buyHint}
                onSubmit={submitChallenge}
                onGiveUp={giveUpChallenge}
                onTimeUp={rescue ? undefined : submitChallenge}
              />
            ) : (
            <aside className="h-full flex flex-col min-h-0 rounded-xl border-2 border-border bg-card overflow-hidden">
              <div className="flex items-center gap-1 p-1 border-b bg-muted/50 shrink-0">
                <button
                  onClick={() => setSidebarTab('problems')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                    sidebarTab === 'problems' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Problems
                </button>
                <button
                  onClick={() => setSidebarTab('bugs')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                    sidebarTab === 'bugs' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Bug className="h-3.5 w-3.5" />
                  Bug Hunt
                </button>
              </div>
              {sidebarTab === 'problems' ? (
                <ProblemList
                  activeProblemId={activeProblemId}
                  completedIds={completedIds}
                  openTopics={openTopics}
                  onToggleTopic={toggleTopic}
                  onPick={handleProblemClick}
                  calm={settings.calmMode}
                  percent={progressPercent}
                  challengeUnlocked={challengeUnlocked}
                  remainingForGate={remainingForGate}
                  gateTopicComplete={gateTopicComplete}
                  gatePercent={CHALLENGE_GATE_PERCENT}
                  signedIn={signedIn}
                />
              ) : (
                <BugList
                  activeBugId={activeBugId}
                  completedIds={bugCompletedIds}
                  onPick={handleBugClick}
                  xpFor={bugFixXp}
                  calm={settings.calmMode}
                  signedIn={signedIn}
                />
              )}
            </aside>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={82} minSize={60} className="min-w-0">
            <div className="h-full flex flex-col gap-3 min-h-0">
              <div className="flex-1 min-h-0">
                <ResizablePanelGroup orientation="horizontal" className="h-full gap-3">
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    <section className={cn('h-full rounded-xl border-2 bg-card overflow-hidden shadow-sm flex flex-col min-h-0 relative', challengeActive ? 'border-rose-500/60' : 'border-border')}>
                      {/* B6 laser frame — a rotating conic border while in the arena.
                          Masked to a thin ring so the editor stays visible + usable. */}
                      {challengeActive && !settings.calmMode && (
                        <div
                          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl"
                          style={{
                            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                            WebkitMaskComposite: 'xor',
                            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                            maskComposite: 'exclude',
                            padding: 2,
                          }}
                        >
                          <div
                            className="absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2 animate-arena-laser"
                            style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(244,63,94,0.95) 35deg, transparent 80deg, transparent 190deg, rgba(251,146,60,0.8) 225deg, transparent 270deg)' }}
                          />
                        </div>
                      )}
                      <div className="relative z-30 flex items-center gap-2 px-3 py-2 border-b bg-muted/50 shrink-0">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Editor</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {isPlaying ? 'read-only · playing' : '⌘/Ctrl+Enter to run · click gutter for breakpoints'}
                        </span>
                      </div>
                      {settings.aiTutor && !sessionPending && !challengeActive && (
                        <div className="flex items-center gap-1.5 px-2 py-1 border-b bg-background/60 shrink-0 overflow-x-auto">
                          <AiInsights
                            code={code}
                            lang={aiLang}
                            locked={!signedIn}
                            onUseChallenge={handleUseChallenge}
                            onBeforeAi={requestAiCharge}
                          />
                        </div>
                      )}
                      <div className="relative flex-1 min-h-0 overflow-hidden">
                        {/* E2 run ripple — a quick pulse into the editor on Run. */}
                        <AnimatePresence>
                          {runPulse > 0 && (
                            <motion.span
                              key={runPulse}
                              initial={{ scale: 0, opacity: 0.5 }}
                              animate={{ scale: 6, opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className="pointer-events-none absolute left-1/2 top-2 z-10 h-16 w-16 -translate-x-1/2 rounded-full bg-pink-500/25"
                            />
                          )}
                        </AnimatePresence>
                        <CodeEditor
                          value={code}
                          onChange={handleCodeChange}
                          onRun={handleRunClick}
                          highlight={editorHighlight}
                          breakpoints={breakpoints}
                          onToggleBreakpoint={toggleBreakpoint}
                          readOnly={isPlaying}
                          errorLine={errorLine}
                        />
                      </div>
                      {settings.complexityMeter && currentLoop && (
                        <div className="shrink-0 px-2 pb-2 pt-1">
                          <ComplexityMeter loop={currentLoop} currentIndex={currentIndex} />
                        </div>
                      )}
                      {!challengeActive && (activeBug || activeProblem?.kind === 'practice') && (
                        <div className="shrink-0 px-2 pb-2 pt-1">
                          <PracticeCheck
                            title={activeBug ? activeBug.title : activeProblem!.title}
                            goal={activeBug ? activeBug.goal : activeProblem!.goal ?? ''}
                            kind={activeBug ? 'bug' : 'practice'}
                            result={checkResult}
                            busy={checkBusy}
                            locked={!signedIn}
                            onCheck={activeBug ? checkBug : checkPractice}
                            calm={settings.calmMode}
                          />
                        </div>
                      )}
                      {/* Notices overlay the editor bottom so they never reflow the
                          surrounding panels when they appear or disappear. */}
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex flex-col gap-2">
                        {error && (
                          <div className="pointer-events-auto flex items-start gap-2 p-2.5 rounded-lg border-2 border-rose-300 bg-rose-50/95 dark:bg-rose-950/90 backdrop-blur-sm text-rose-900 dark:text-rose-200 text-sm shadow-lg max-h-40 overflow-y-auto">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Could not run this code</span>
                                {settings.aiTutor && !sessionPending && !challengeActive && (
                                  <div className="ml-auto shrink-0">
                                    <AiTutor
                                      getRequest={buildErrorRequest}
                                      resetKey={error}
                                      lang={aiLang}
                                      locked={!signedIn}
                                      variant="fix"
                                      onBeforeAi={requestAiCharge}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="font-mono text-xs mt-1 wrap-break-word">{error}</div>
                            </div>
                          </div>
                        )}

                        {!error && trace?.truncated && (
                          <div className="pointer-events-auto flex items-start gap-2 p-2.5 rounded-lg border-2 border-amber-300 bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-sm text-amber-900 dark:text-amber-200 text-sm shadow-lg max-h-40 overflow-y-auto">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold">Stopped early — possible infinite loop</div>
                              <div className="text-xs mt-1 wrap-break-word">
                                {trace.stopReason} Showing the first {trace.steps.length - 1} steps so you can see what happened.
                              </div>
                            </div>
                          </div>
                        )}

                        {!error && !trace?.truncated && trace?.warnings && trace.warnings.length > 0 && (
                          <div className="pointer-events-auto flex items-start gap-2 p-2.5 rounded-lg border border-amber-300/70 bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-sm text-amber-800 dark:text-amber-300 text-xs shadow-lg max-h-40 overflow-y-auto">
                            <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold">Heads up</div>
                              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                                {trace.warnings.map((w, i) => (
                                  <li key={i} className="wrap-break-word">{w}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    <div className="h-full flex flex-col gap-3 min-h-0 relative">
                      {stepBanner}
                      <div className="flex-1 min-h-0">
                        <ResizablePanelGroup orientation="vertical" className="h-full gap-3">
                          <ResizablePanel defaultSize={55} minSize={20} className="min-h-0">
                            {floating ? (
                              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center">
                                <PopOutIcon className="h-6 w-6 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Panel is floating.</p>
                                <button
                                  onClick={() => setFloating(false)}
                                  className="rounded-md border px-2.5 py-1 text-xs font-semibold hover:bg-background"
                                >
                                  Dock it back
                                </button>
                              </div>
                            ) : (
                              visualPanel
                            )}
                          </ResizablePanel>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={45} minSize={20} className="min-h-0">
                            {consolePanel}
                          </ResizablePanel>
                        </ResizablePanelGroup>
                      </div>
                      <AnimatePresence>
                        {activeQuestion && (
                          <QuizOverlay question={activeQuestion} streak={streak} onResolved={resolveQuiz} />
                        )}
                      </AnimatePresence>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>

              {timelinePanel}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      <div className="shrink-0 px-3 pb-3 pt-1 bg-background border-t">
        <PlaybackControls
          isPlaying={isPlaying}
          onPlayPause={() => {
            if (!trace || trace.steps.length === 0) return
            if (settings.ambientSound) unlockAudio()
            if (currentIndex >= lastIndex) setCurrentIndex(0)
            setIsPlaying((p) => !p)
          }}
          onStepBack={() => { setIsPlaying(false); setCurrentIndex((i) => Math.max(0, i - 1)) }}
          onStepForward={() => { setIsPlaying(false); advanceRef.current() }}
          onFirst={() => { setIsPlaying(false); setCurrentIndex(0) }}
          onLast={() => { setIsPlaying(false); setCurrentIndex(lastIndex) }}
          onReset={() => { setIsPlaying(false); setCurrentIndex(0) }}
          onSeek={(idx) => { setIsPlaying(false); setCurrentIndex(idx) }}
          currentIndex={currentIndex}
          totalSteps={totalSteps}
          speed={speed}
          onSpeedChange={setSpeed}
          breakpointCount={breakpoints.size}
          onContinue={continueToBreakpoint}
        />
      </div>
    </div>
  )
}
