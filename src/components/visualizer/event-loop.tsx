'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Layers, Globe, Zap, Clock } from 'lucide-react'
import type { AsyncSnapshot } from '@/lib/visualizer/types'
import { cn } from '@/lib/utils'

function Lane({
  title,
  icon,
  items,
  tone,
  reverse,
  empty,
}: {
  title: string
  icon: React.ReactNode
  items: string[]
  tone: string
  reverse?: boolean
  empty: string
}) {
  const shown = reverse ? [...items].reverse() : items
  return (
    <div className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-card/60 p-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        {icon}
        {title}
        <span className="ml-auto tabular-nums">{items.length}</span>
      </div>
      <div className="flex flex-col gap-1">
        {shown.length === 0 ? (
          <div className="rounded border border-dashed border-border/60 px-2 py-1 text-center text-[10px] text-muted-foreground/70">
            {empty}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {shown.map((it, i) => (
              <motion.div
                key={`${it}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                className={cn('rounded px-2 py-1 font-mono text-[11px] text-white shadow-sm', tone)}
              >
                {it}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

const PHASE_LABEL: Record<AsyncSnapshot['phase'], string> = {
  sync: 'Running synchronous code',
  microtask: 'Draining microtasks',
  macrotask: 'Running a task (macrotask)',
}

// Visualizes the browser event loop: the synchronous call stack, timers held in
// the Web-API area, and the micro / macro task queues that feed the stack.
export function EventLoopPanel({ async }: { async: AsyncSnapshot | undefined }) {
  if (!async) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        This snippet has no async work. Try <code className="mx-1 font-mono">setTimeout</code> or{' '}
        <code className="mx-1 font-mono">Promise.resolve().then()</code>.
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-2">
      <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium">
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            async.phase === 'sync' ? 'bg-sky-500' : async.phase === 'microtask' ? 'bg-fuchsia-500' : 'bg-orange-500',
          )}
        />
        {PHASE_LABEL[async.phase]}
      </div>
      <Lane
        title="Call stack"
        icon={<Layers className="h-3.5 w-3.5" />}
        items={async.callStack}
        tone="bg-sky-600"
        reverse
        empty="empty"
      />
      <Lane
        title="Web APIs (timers)"
        icon={<Globe className="h-3.5 w-3.5" />}
        items={async.webApis}
        tone="bg-emerald-600"
        empty="no pending timers"
      />
      <div className="grid grid-cols-2 gap-2">
        <Lane
          title="Microtasks"
          icon={<Zap className="h-3.5 w-3.5" />}
          items={async.microtasks}
          tone="bg-fuchsia-600"
          empty="empty"
        />
        <Lane
          title="Task queue"
          icon={<Clock className="h-3.5 w-3.5" />}
          items={async.macrotasks}
          tone="bg-orange-600"
          empty="empty"
        />
      </div>
    </div>
  )
}
