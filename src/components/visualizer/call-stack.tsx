'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FrameSnapshot, HeapSnapshot, Step } from '@/lib/visualizer/types'
import { VariableCard } from './code-viewer'

// Palette for alias groups — one color per heap object shared by ≥2 variables.
const ALIAS_COLORS = ['#0ea5e9', '#f97316', '#a855f7', '#10b981', '#ec4899', '#eab308']

interface MemoryPanelProps {
  step?: Step
  heap: Map<number, HeapSnapshot>
  // Signatures "frameName:varName" that changed since the previous step.
  changed: Set<string>
  // arrayName -> (cellIndex -> pointer variable names) for the top frame.
  indexPointers: Map<string, Map<number, string[]>>
  // Render numeric arrays as bar charts.
  barMode: boolean
  // When true, mark variables that reference the same heap object (aliasing).
  aliasWires?: boolean
}

// Renders the call stack innermost-frame-first, each frame showing its own
// variables — a debugger-style scoped memory view.
export function MemoryPanel({ step, heap, changed, indexPointers, barMode, aliasWires }: MemoryPanelProps) {
  const frames = step?.frames ?? []
  // Innermost (top of stack) first, global last.
  const ordered = [...frames].reverse()

  const anyVars = frames.some((f) => f.vars.length > 0)

  // A heap id is "aliased" when two or more variables (across all frames)
  // reference it — e.g. an array passed into a function shares its identity
  // with the caller's variable. Assign each such id a stable color.
  const aliasColorById = new Map<number, string>()
  if (aliasWires) {
    const count = new Map<number, number>()
    for (const f of frames) {
      for (const v of f.vars) {
        if (v.value.t === 'ref') count.set(v.value.id, (count.get(v.value.id) ?? 0) + 1)
      }
    }
    const aliased = [...count.entries()].filter(([, c]) => c >= 2).map(([id]) => id).sort((a, b) => a - b)
    aliased.forEach((id, i) => aliasColorById.set(id, ALIAS_COLORS[i % ALIAS_COLORS.length]))
  }

  return (
    <div className="flex flex-col gap-2">
      {!anyVars && (
        <div className="text-sm text-muted-foreground italic text-center py-6">
          No variables yet — press <strong>Run</strong> to begin.
        </div>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        {ordered.map((frame, idx) => {
          // The real stack index (0 = global) for depth styling.
          const stackIndex = frames.length - 1 - idx
          const isTop = idx === 0 && frames.length > 1
          return (
            <FrameGroup
              key={`${stackIndex}:${frame.name}:${frame.callLine ?? 0}`}
              frame={frame}
              heap={heap}
              changed={changed}
              isTop={isTop}
              depth={stackIndex}
              focus={step?.focus}
              indexPointers={indexPointers}
              barMode={barMode}
              aliasColorById={aliasColorById}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function FrameGroup({
  frame,
  heap,
  changed,
  isTop,
  depth,
  focus,
  indexPointers,
  barMode,
  aliasColorById,
}: {
  frame: FrameSnapshot
  heap: Map<number, HeapSnapshot>
  changed: Set<string>
  isTop: boolean
  depth: number
  focus?: Step['focus']
  indexPointers: Map<string, Map<number, string[]>>
  barMode: boolean
  aliasColorById: Map<number, string>
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={cn(
        'rounded-lg border',
        isTop ? 'border-amber-400/70 bg-amber-50/40 dark:bg-amber-950/20' : 'border-border/70 bg-muted/20',
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Layers className={cn('h-3.5 w-3.5', isTop ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className="text-xs font-mono font-semibold">
          {frame.kind === 'global' ? 'global' : `${frame.name}()`}
        </span>
        {frame.callLine != null && (
          <span className="text-[10px] text-muted-foreground">called from line {frame.callLine}</span>
        )}
        {isTop && (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-bold">
            active
          </span>
        )}
        <span className={cn('text-[10px] text-muted-foreground', !isTop && 'ml-auto')}>#{depth}</span>
      </div>
      {frame.vars.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-2 pb-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {frame.vars.map((v) => {
              const arrPointers = indexPointers.get(v.name)
              const aliasId = v.value.t === 'ref' ? v.value.id : undefined
              const aliasColor = aliasId != null ? aliasColorById.get(aliasId) : undefined
              return (
                <VariableCard
                  key={v.name}
                  name={v.name}
                  value={v.value}
                  heap={heap}
                  isClosure={v.closure}
                  focused={focus?.varName === v.name}
                  focusedArrayIndex={focus?.arrayIndex}
                  focusedObjectKey={focus?.objectKey}
                  recentlyChanged={changed.has(`${frame.name}:${v.name}`)}
                  indexPointers={isTop ? arrPointers : undefined}
                  barMode={barMode}
                  aliasColor={aliasColor}
                  aliasId={aliasColor ? aliasId : undefined}
                />
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
