'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { interpret } from '@/lib/visualizer/interpreter'
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

function safeInterpret(source: string): { trace: Trace | null; error: string | null } {
  try {
    const trace = interpret(source, { maxSteps: 2000 })
    return { trace, error: null }
  } catch (e) {
    return { trace: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export default function Home() {
  const [code, setCode] = useState<string>(DEMO_EXAMPLES[0].code)
  const initial = useMemo(() => safeInterpret(DEMO_EXAMPLES[0].code), [])
  const [trace, setTrace] = useState<Trace | null>(initial.trace)
  const [error, setError] = useState<string | null>(initial.error)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [activeExampleId, setActiveExampleId] = useState(DEMO_EXAMPLES[0].id)

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

  const runQuiet = useCallback((source: string) => {
    const { trace: t, error: err } = safeInterpret(source)
    setTrace(t)
    setError(err)
    setCurrentIndex(0)
    setIsPlaying(false)
    setActiveQuestion(null)
    answeredRef.current = new Set()
  }, [])

  const runAndPlay = useCallback((source: string) => {
    const { trace: t, error: err } = safeInterpret(source)
    setTrace(t)
    setError(err)
    setCurrentIndex(0)
    setActiveQuestion(null)
    answeredRef.current = new Set()
    syncCodeToLocation(source)
    setIsPlaying(!!t && t.steps.length > 1)
  }, [])

  const handleCodeChange = useCallback((value: string) => {
    setCode(value)
    setActiveExampleId('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runQuiet(value), 350)
  }, [runQuiet])

  // Load shared code from the URL on first mount.
  useEffect(() => {
    const shared = readCodeFromLocation()
    if (shared) {
      // Hydration-safe: the URL is only readable on the client, so this must
      // happen in an effect rather than during render / state init.
      /* eslint-disable react-hooks/set-state-in-effect */
      setCode(shared)
      setActiveExampleId('')
      runQuiet(shared)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSteps = trace?.steps.length ?? 0
  const lastIndex = totalSteps - 1

  // Fire confetti when a quiz run finishes on a hot streak.
  const celebrate = useCallback(() => {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } })
  }, [])

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

  // Auto-advance while playing.
  useEffect(() => {
    if (!isPlaying || !trace) return
    timerRef.current = setTimeout(() => advanceRef.current(), 700 / speed)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPlaying, currentIndex, speed, trace])

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
      return ns
    })
    setCurrentIndex(q.stepIndex)
    if (q.stepIndex >= lastIndex && correct) {
      setTimeout(celebrate, 150)
    }
  }, [activeQuestion, lastIndex, celebrate])

  const currentStep: Step | undefined = trace?.steps[currentIndex]
  const previousStep: Step | undefined = trace?.steps[currentIndex - 1]

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
    }
  }, [currentStep])

  const handleExampleClick = (ex: typeof DEMO_EXAMPLES[number]) => {
    setActiveExampleId(ex.id)
    setCode(ex.code)
    runQuiet(ex.code)
  }

  const handleNewClick = () => {
    setActiveExampleId('')
    setCode(BLANK_CODE)
    runQuiet(BLANK_CODE)
  }

  const handleRunClick = useCallback(() => {
    runAndPlay(code)
  }, [code, runAndPlay])

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
                'group flex items-center gap-1 rounded-md pr-1 transition-colors whitespace-nowrap',
                isActive ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <button
                onClick={() => setView(tab.id)}
                className="flex items-center gap-1.5 text-sm font-semibold px-2 py-1"
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
              {tab.key && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFeature(tab.key!, false) }}
                  title={`Close ${tab.label}`}
                  className="rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
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
    <div className="h-screen flex flex-col bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 overflow-hidden">
      <Toaster position="top-center" />
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
            <label className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mr-1">
              <GraduationCap className="h-4 w-4" />
              Quiz
              <Switch checked={quizMode} onCheckedChange={(v) => { setQuizMode(v); if (!v) setActiveQuestion(null); setStreak(0) }} size="sm" />
            </label>
            <SettingsPanel
              settings={settings}
              onToggle={setFeature}
              onReset={resetAll}
              enabledCount={enabledCount}
            />
            <AnimatedThemeToggler />
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
            <Button variant="default" className='bg-linear-to-r from-pink-500 to-red-500' size="sm" onClick={handleRunClick}>
              <Play className="h-4 w-4 mr-1" />
              Run
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-3">
        <ResizablePanelGroup orientation="horizontal" className="h-full gap-3">
          <ResizablePanel defaultSize={18} minSize={14} className="min-w-0">
            <aside className="h-full flex flex-col min-h-0 rounded-xl border-2 border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 shrink-0">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Demo examples</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {DEMO_EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => handleExampleClick(ex)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-lg border-2 transition-all duration-150',
                      activeExampleId === ex.id
                        ? 'border-foreground bg-foreground text-background shadow-md'
                        : 'border-border bg-card hover:border-foreground/30 hover:bg-accent',
                    )}
                  >
                    <div className="font-semibold text-sm leading-tight">{ex.title}</div>
                    <div className={cn(
                      'text-[11px] mt-0.5 leading-snug',
                      activeExampleId === ex.id ? 'text-background/70' : 'text-muted-foreground',
                    )}>
                      {ex.description}
                    </div>
                  </button>
                ))}
                <div className="p-2.5 rounded-lg bg-muted/50 text-[11px] text-muted-foreground leading-relaxed mt-3">
                  <strong className="text-foreground">Tip:</strong> Pick a demo or press <strong>New</strong>. Click the gutter to set breakpoints. Use <strong>←/→</strong> to step, <strong>Space</strong> to play. Toggle <strong>Quiz</strong> to test yourself.
                </div>
              </div>
            </aside>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={82} minSize={60} className="min-w-0">
            <div className="h-full flex flex-col gap-3 min-h-0">
              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border-2 border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-sm shrink-0">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold">Could not run this code</div>
                    <div className="font-mono text-xs mt-1 wrap-break-word">{error}</div>
                  </div>
                </div>
              )}

              {!error && trace?.truncated && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm shrink-0">
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
                <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/25 text-amber-800 dark:text-amber-300 text-xs shrink-0">
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

              <div className="flex-1 min-h-0">
                <ResizablePanelGroup orientation="horizontal" className="h-full gap-3">
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    <section className="h-full rounded-xl border-2 border-border bg-card overflow-hidden shadow-sm flex flex-col min-h-0 relative">
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 shrink-0">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Editor</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {isPlaying ? 'read-only · playing' : '⌘/Ctrl+Enter to run · click gutter for breakpoints'}
                        </span>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <CodeEditor
                          value={code}
                          onChange={handleCodeChange}
                          onRun={handleRunClick}
                          highlight={editorHighlight}
                          breakpoints={breakpoints}
                          onToggleBreakpoint={toggleBreakpoint}
                          readOnly={isPlaying}
                        />
                      </div>
                      {settings.complexityMeter && currentLoop && (
                        <div className="shrink-0 px-2 pb-2 pt-1">
                          <ComplexityMeter loop={currentLoop} currentIndex={currentIndex} />
                        </div>
                      )}
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
