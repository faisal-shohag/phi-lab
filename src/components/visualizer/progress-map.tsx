'use client'

// The progress map: everything the learner has done in one place, and — the
// point of it — one obvious thing to do next.
//
// The sidebar already shows per-topic bars, so this only earns its keep by
// showing what the sidebar can't: the whole run at once, the Challenge gate as a
// destination rather than a tooltip, and where Bug Hunt sits beside the
// curriculum instead of buried behind a tab.
//
// Purely presentational. Everything comes from the progress the page has already
// loaded, so it opens instantly and can never disagree with the sidebar.

import { motion } from 'framer-motion'
import {
  Bug, Check, GitBranch, Repeat, Brackets, FunctionSquare, Boxes,
  ArrowDownWideNarrow, Hourglass, Lock, Swords, Sparkles, type LucideIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  PROBLEM_TOPICS, TOTAL_PROBLEMS, CHALLENGE_GATE_TOPIC,
  type Problem, type TopicId,
} from '@/lib/visualizer/problems'
import { BUG_LEVELS, type BugLevel } from '@/lib/visualizer/bugs'
import { cn } from '@/lib/utils'

const TOPIC_ICON: Record<TopicId, LucideIcon> = {
  conditionals: GitBranch,
  loops: Repeat,
  arrays: Brackets,
  functions: FunctionSquare,
  objects: Boxes,
  algorithms: ArrowDownWideNarrow,
  async: Hourglass,
}

export interface ProgressMapProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  completedIds: Set<string>
  bugCompletedIds: Set<string>
  percent: number | null
  challengeUnlocked: boolean
  gatePercent: number
  signedIn: boolean
  /** Jump to a problem — the page loads it and switches to the Problems tab. */
  onPickProblem: (p: Problem) => void
  /** Jump to a bug level. */
  onPickBug: (b: BugLevel) => void
  onOpenChallenge: () => void
}

export function ProgressMap({
  open,
  onOpenChange,
  completedIds,
  bugCompletedIds,
  percent,
  challengeUnlocked,
  gatePercent,
  signedIn,
  onPickProblem,
  onPickBug,
  onOpenChallenge,
}: ProgressMapProps) {
  // Derived here rather than taken from the progress endpoint, because a guest
  // never calls it: the server's counts would sit at their zero defaults and the
  // gate would claim a signed-out visitor at 0% had "just Functions left". The
  // same arithmetic the server does, over the ids we already have — so it agrees
  // with the sidebar for members and tells the truth for everyone else.
  const gateNeeded = Math.ceil(TOTAL_PROBLEMS * gatePercent)
  const remainingForGate = Math.max(0, gateNeeded - completedIds.size)
  const gateTopic = PROBLEM_TOPICS.find((t) => t.id === CHALLENGE_GATE_TOPIC)
  const gateTopicComplete = !!gateTopic && gateTopic.problems.every((p) => completedIds.has(p.id))
  // The next thing to do: the first unsolved problem in running order. This is
  // the whole reason to open the map, so it gets the biggest button.
  const nextProblem = PROBLEM_TOPICS.flatMap((t) => t.problems).find((p) => !completedIds.has(p.id))
  const nextBug = BUG_LEVELS.find((b) => !bugCompletedIds.has(b.id))
  const bugsDone = BUG_LEVELS.filter((b) => bugCompletedIds.has(b.id)).length

  const jump = (fn: () => void) => { fn(); onOpenChange(false) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The width variant must match DialogContent's own default key
          (sm:max-w-sm) or tailwind-merge keeps both and the more specific
          default wins above 640px. A plain `max-w-lg` here rendered this map at
          384px on every desktop — which is what truncated the "Next up" line. */}
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500" /> Your map
          </DialogTitle>
        </DialogHeader>

        {/* Guests see the whole map, just with nothing ticked — the shape of the
            curriculum is the useful part, and they can already solve any of it.
            Only the tracking needs an account, so that's all the nudge claims. */}
        {!signedIn && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
            Everything here is open to you. <strong className="text-foreground">Sign in free</strong> to keep your progress, earn XP, and unlock Challenge mode.
          </p>
        )}

        {/* Two columns once there's room: the run itself on the left, what to do
            about it on the right. Single column below sm. */}
        <div className="grid gap-4 sm:grid-cols-[1.35fr_1fr] sm:items-start">
          <div>
            <div className="rounded-xl border-2 border-border bg-muted/40 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Curriculum</span>
                <span className="font-mono text-sm font-bold tabular-nums">{Math.round((percent ?? 0) * 100)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full bg-linear-to-r from-pink-500 to-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((percent ?? 0) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 20 }}
                />
              </div>
            </div>

            {/* The spine: topics in order, each a node you can jump into. */}
            <div className="relative mt-3 pl-1">
              <div className="absolute bottom-4 left-[19px] top-4 w-0.5 bg-border" aria-hidden />
              <ul className="space-y-1">
                {PROBLEM_TOPICS.map((topic) => {
                  const done = topic.problems.filter((p) => completedIds.has(p.id)).length
                  const total = topic.problems.length
                  const complete = done === total
                  const started = done > 0
                  const Icon = TOPIC_ICON[topic.id]
                  const target = topic.problems.find((p) => !completedIds.has(p.id)) ?? topic.problems[0]
                  return (
                    <li key={topic.id}>
                      <button
                        onClick={() => jump(() => onPickProblem(target))}
                        className="group relative flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-accent"
                      >
                        <span
                          className={cn(
                            'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            complete
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : started
                                ? 'border-pink-500 bg-background text-pink-500'
                                : 'border-border bg-background text-muted-foreground',
                          )}
                        >
                          {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{topic.label}</span>
                            <span className={cn(
                              'shrink-0 font-mono text-[11px] tabular-nums',
                              complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                            )}>
                              {done}/{total}
                            </span>
                          </span>
                          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-border">
                            <span
                              className={cn('block h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-pink-500')}
                              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                            />
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}

                {/* Challenge sits at the end of the spine — it's the destination. */}
                <li>
                  <button
                    onClick={() => challengeUnlocked && jump(onOpenChallenge)}
                    disabled={!challengeUnlocked}
                    className={cn(
                      'relative flex w-full items-center gap-3 rounded-lg p-1.5 text-left',
                      challengeUnlocked ? 'hover:bg-accent' : 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                        challengeUnlocked
                          ? 'border-rose-500 bg-linear-to-br from-rose-500 to-red-600 text-white'
                          : 'border-dashed border-border bg-background text-muted-foreground',
                      )}
                    >
                      {challengeUnlocked ? <Swords className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-semibold">Challenge mode</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {challengeUnlocked ? (
                          'Unlocked — stake XP against an AI-set task.'
                        ) : (
                          <>
                            Needs {Math.round(gatePercent * 100)}% and the Functions topic
                            {remainingForGate > 0 && <> — {remainingForGate} more problem{remainingForGate === 1 ? '' : 's'}</>}
                            {remainingForGate === 0 && !gateTopicComplete && <> — just Functions left</>}
                            .
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Right column: the two things there are to actually do. */}
          <div className="flex flex-col gap-3">
            {nextProblem && (
              <button
                onClick={() => jump(() => onPickProblem(nextProblem))}
                className="w-full rounded-xl bg-linear-to-r from-pink-500 to-red-500 px-3 py-2.5 text-left text-white shadow-lg shadow-pink-500/20 hover:opacity-90"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wide text-white/70">Next up</span>
                {/* Not truncated: descriptions run 50-70 chars and the tail is
                    the part that says what you'd learn. */}
                <span className="block text-sm font-bold">{nextProblem.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-white/80">{nextProblem.description}</span>
              </button>
            )}
            {!nextProblem && (
              <p className="rounded-xl bg-emerald-500/10 py-3 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Every problem solved. The whole map is yours.
              </p>
            )}

            {/* Bug Hunt is a side track, so it sits off the spine. */}
            <button
              onClick={() => nextBug && jump(() => onPickBug(nextBug))}
              disabled={!nextBug}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-border p-2.5 text-left',
                nextBug && 'hover:border-emerald-500/50 hover:bg-accent',
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/60 bg-background text-emerald-600 dark:text-emerald-400">
                <Bug className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Bug Hunt</span>
                  <span className={cn(
                    'font-mono text-[11px] tabular-nums',
                    bugsDone === BUG_LEVELS.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {bugsDone}/{BUG_LEVELS.length}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {nextBug ? 'Side quest — fix broken programs for XP.' : 'Every bug squashed. Nothing left to hunt.'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
