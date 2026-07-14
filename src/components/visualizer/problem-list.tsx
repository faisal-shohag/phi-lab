'use client'

// The curriculum sidebar: topics that open to reveal their problems, with a
// progress bar per topic and a checkmark on everything finished. Replaces the
// old flat demo list.

import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, Eye, Lock, PencilRuler, Swords } from 'lucide-react'
import { PROBLEM_TOPICS, type Problem, type TopicId } from '@/lib/visualizer/problems'
import { cn } from '@/lib/utils'

export interface ProblemListProps {
  activeProblemId: string
  completedIds: Set<string>
  /** Which topics are expanded. */
  openTopics: Set<TopicId>
  onToggleTopic: (id: TopicId) => void
  onPick: (p: Problem) => void
  calm: boolean
  /** Overall catalog progress, 0…1. Null while it is still loading / for guests. */
  percent: number | null
  challengeUnlocked: boolean
  remainingForGate: number
  gateTopicComplete: boolean
  gatePercent: number
  signedIn: boolean
}

export function ProblemList({
  activeProblemId,
  completedIds,
  openTopics,
  onToggleTopic,
  onPick,
  calm,
  percent,
  challengeUnlocked,
  remainingForGate,
  gateTopicComplete,
  gatePercent,
  signedIn,
}: ProblemListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {signedIn && percent !== null && (
        <div className="rounded-lg border-2 border-border bg-muted/40 p-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span>Your progress</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(percent * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-pink-500 to-red-500"
              initial={false}
              animate={{ width: `${Math.round(percent * 100)}%` }}
              transition={calm ? { duration: 0.6 } : { type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <div className={cn(
            'mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug',
            challengeUnlocked ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
          )}>
            {challengeUnlocked ? <Swords className="h-3 w-3 mt-px shrink-0" /> : <Lock className="h-3 w-3 mt-px shrink-0" />}
            <span>
              {challengeUnlocked ? (
                <>Challenge mode is <strong>unlocked</strong>. Go stake some XP.</>
              ) : (
                <>
                  Challenge unlocks at {Math.round(gatePercent * 100)}% + the Functions topic
                  {remainingForGate > 0 && <> — {remainingForGate} more to go</>}
                  {remainingForGate === 0 && !gateTopicComplete && <> — just Functions left</>}
                  .
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {PROBLEM_TOPICS.map((topic) => {
        const done = topic.problems.filter((p) => completedIds.has(p.id)).length
        const total = topic.problems.length
        const open = openTopics.has(topic.id)
        const complete = done === total && total > 0
        return (
          <div key={topic.id} className="rounded-lg border-2 border-border bg-card overflow-hidden">
            <button
              onClick={() => onToggleTopic(topic.id)}
              className="w-full text-left px-2.5 py-2 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: calm ? 0.3 : 0.15 }} className="shrink-0">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </motion.span>
                <span className="font-semibold text-sm leading-tight flex-1 min-w-0 truncate">{topic.label}</span>
                <span className={cn(
                  'text-[10px] tabular-nums font-semibold shrink-0',
                  complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}>
                  {done}/{total}
                </span>
              </div>
              <div className="mt-1.5 ml-5 h-1 overflow-hidden rounded-full bg-border">
                <motion.div
                  className={cn('h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-foreground/40')}
                  initial={false}
                  animate={{ width: `${total ? (done / total) * 100 : 0}%` }}
                  transition={calm ? { duration: 0.5 } : { type: 'spring', stiffness: 140, damping: 22 }}
                />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: calm ? 0.35 : 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="px-1.5 pb-1.5 pt-0.5 space-y-1">
                    <p className="px-1 pb-1 text-[10px] leading-snug text-muted-foreground">{topic.blurb}</p>
                    {topic.problems.map((p) => {
                      const isDone = completedIds.has(p.id)
                      const isActive = activeProblemId === p.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => onPick(p)}
                          className={cn(
                            'w-full text-left p-2 rounded-md border transition-colors duration-150',
                            isActive
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-transparent hover:border-foreground/20 hover:bg-accent',
                          )}
                        >
                          <div className="flex items-start gap-1.5">
                            <span className={cn(
                              'mt-0.5 shrink-0 rounded-full p-px',
                              isDone
                                ? 'text-emerald-500'
                                : isActive ? 'text-background/50' : 'text-muted-foreground/50',
                            )}>
                              {isDone
                                ? <Check className="h-3 w-3" />
                                : p.kind === 'practice'
                                  ? <PencilRuler className="h-3 w-3" />
                                  : <Eye className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="font-medium text-xs leading-tight truncate">{p.title}</span>
                                {p.kind === 'practice' && (
                                  <span className={cn(
                                    'shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide',
                                    isActive
                                      ? 'bg-background/20 text-background'
                                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                                  )}>
                                    Solve
                                  </span>
                                )}
                              </span>
                              <span className={cn(
                                'mt-0.5 block text-[10px] leading-snug',
                                isActive ? 'text-background/70' : 'text-muted-foreground',
                              )}>
                                {p.description}
                              </span>
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      <div className="p-2.5 rounded-lg bg-muted/50 text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Tip:</strong>{' '}
        <Eye className="inline h-3 w-3 -mt-px" /> problems are watched — step to the end to finish one.{' '}
        <PencilRuler className="inline h-3 w-3 -mt-px" /> problems you write yourself, then press{' '}
        <strong>Check</strong>. Use <strong>←/→</strong> to step, <strong>Space</strong> to play.
      </div>
    </div>
  )
}
