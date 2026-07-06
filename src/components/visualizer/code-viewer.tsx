'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { HeapSnapshot, Primitive, ValueSnapshot } from '@/lib/visualizer/types'
import { formatPrimitive, primitiveColor, resolveValue } from '@/lib/visualizer/values'

// ---------------------------------------------------------------------------
// Variable card — resolves ValueSnapshot refs against the step's heap.
// ---------------------------------------------------------------------------

interface VariableCardProps {
  name: string
  value: ValueSnapshot
  heap: Map<number, HeapSnapshot>
  isClosure?: boolean
  focused: boolean
  focusedArrayIndex?: number
  focusedObjectKey?: string
  recentlyChanged: boolean
  // Optional index-pointer labels to render under array cells: index -> names.
  indexPointers?: Map<number, string[]>
  // Show numeric arrays as bars instead of cells.
  barMode?: boolean
}

export function VariableCard({
  name,
  value,
  heap,
  isClosure,
  focused,
  focusedArrayIndex,
  focusedObjectKey,
  recentlyChanged,
  indexPointers,
  barMode,
}: VariableCardProps) {
  const resolved = resolveValue(value, heap)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.8 }}
      className={cn(
        'rounded-lg border-2 p-2',
        focused
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:border-amber-600 shadow-lg shadow-amber-200/40 dark:shadow-amber-900/40'
          : 'border-border bg-card',
        recentlyChanged && 'ring-2 ring-amber-400/70 dark:ring-amber-500/70 ring-offset-1 ring-offset-background',
        isClosure && !focused && 'border-dashed opacity-90',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-mono font-bold text-foreground">{name}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{resolved.kind}</span>
        {isClosure && (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-violet-500 dark:text-violet-400 font-semibold">
            closure
          </span>
        )}
      </div>
      {resolved.kind === 'primitive' && (
        <PrimitiveValue value={resolved.primitive as Primitive} recentlyChanged={recentlyChanged} />
      )}
      {resolved.kind === 'array' && (
        <ArrayValue
          cells={resolved.heap?.cells ?? []}
          heap={heap}
          focusedIndex={focused ? focusedArrayIndex : undefined}
          indexPointers={indexPointers}
          barMode={barMode}
        />
      )}
      {resolved.kind === 'object' && (
        <ObjectValue fields={resolved.heap?.fields ?? []} heap={heap} focusedKey={focused ? focusedObjectKey : undefined} />
      )}
      {resolved.kind === 'function' && (
        <div className="font-mono text-sm text-teal-600 dark:text-teal-400">ƒ {resolved.heap?.label ?? ''}()</div>
      )}
    </motion.div>
  )
}

function PrimitiveValue({ value, recentlyChanged }: { value: Primitive; recentlyChanged: boolean }) {
  const display = formatPrimitive(value)
  return (
    <motion.div
      key={display}
      initial={recentlyChanged ? { scale: 1.15, color: 'rgb(245 158 11)' } : false}
      animate={{ scale: 1, color: undefined }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, duration: 0.4 }}
      className={cn('font-mono text-sm font-semibold', primitiveColor(value))}
    >
      {display}
    </motion.div>
  )
}

function cellText(v: ValueSnapshot, heap: Map<number, HeapSnapshot>): string {
  if (v.t === 'prim') {
    const p = v.v
    if (p === null) return 'null'
    if (p === undefined) return 'undef'
    return String(p)
  }
  const h = heap.get(v.id)
  if (h?.kind === 'array') return '[…]'
  if (h?.kind === 'function') return 'ƒ'
  return '{…}'
}

function ArrayValue({
  cells,
  heap,
  focusedIndex,
  indexPointers,
  barMode,
}: {
  cells: ValueSnapshot[]
  heap: Map<number, HeapSnapshot>
  focusedIndex?: number
  indexPointers?: Map<number, string[]>
  barMode?: boolean
}) {
  if (cells.length === 0) {
    return <div className="text-xs text-muted-foreground italic">empty [ ]</div>
  }

  const numeric = cells.every((c) => c.t === 'prim' && typeof c.v === 'number')
  if (barMode && numeric) {
    const values = cells.map((c) => (c.t === 'prim' ? (c.v as number) : 0))
    const max = Math.max(1, ...values.map((v) => Math.abs(v)))
    return (
      <div className="flex items-end gap-1.5 h-32 pt-2">
        {cells.map((cell, i) => {
          const v = values[i]
          const isFocused = focusedIndex === i
          const pointers = indexPointers?.get(i)
          return (
            <div key={i} className="flex flex-col items-center justify-end gap-1 flex-1 min-w-6 h-full">
              <span className="text-[10px] font-mono font-bold leading-none">{v}</span>
              <motion.div
                layout
                animate={{ height: `${(Math.abs(v) / max) * 100}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className={cn(
                  'w-full rounded-t-sm min-h-1',
                  isFocused ? 'bg-rose-500' : 'bg-sky-400 dark:bg-sky-500',
                )}
              />
              <span className="text-[9px] text-muted-foreground leading-none">{i}</span>
              {pointers && pointers.length > 0 && (
                <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                  {pointers.join(',')}↑
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {cells.map((cell, i) => {
        const isFocused = focusedIndex === i
        const pointers = indexPointers?.get(i)
        const isNum = cell.t === 'prim' && typeof cell.v === 'number'
        const isBool = cell.t === 'prim' && typeof cell.v === 'boolean'
        return (
          <motion.div
            key={i}
            layout
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: isFocused ? 1.12 : 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22, mass: 0.7 }}
            className={cn(
              'flex flex-col items-center justify-center rounded-md border-2 px-1.5 py-0.5 min-w-8 font-mono',
              isFocused
                ? 'border-rose-500 bg-rose-100 dark:bg-rose-950/60 shadow-md shadow-rose-300/40'
                : 'border-border bg-background',
            )}
          >
            <span className="text-[9px] text-muted-foreground leading-none mb-0.5">{i}</span>
            <span
              className={cn(
                'text-xs font-bold leading-none',
                isNum ? 'text-sky-600 dark:text-sky-400'
                : isBool ? 'text-fuchsia-600 dark:text-fuchsia-400'
                : cell.t === 'prim' && (cell.v === null || cell.v === undefined) ? 'text-muted-foreground'
                : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {cellText(cell, heap)}
            </span>
            {pointers && pointers.length > 0 && (
              <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 leading-none mt-0.5">
                {pointers.join(',')}↑
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function ObjectValue({
  fields,
  heap,
  focusedKey,
}: {
  fields: { key: string; value: ValueSnapshot }[]
  heap: Map<number, HeapSnapshot>
  focusedKey?: string
}) {
  if (fields.length === 0) {
    return <div className="text-xs text-muted-foreground italic">empty {'{ }'}</div>
  }
  return (
    <div className="font-mono text-xs space-y-0.5">
      {fields.map((f) => (
        <div
          key={f.key}
          className={cn('flex gap-2 rounded px-1', focusedKey === f.key && 'bg-amber-200/50 dark:bg-amber-900/40')}
        >
          <span className="text-muted-foreground">{f.key}:</span>
          <span className="font-semibold text-foreground">{cellText(f.value, heap)}</span>
        </div>
      ))}
    </div>
  )
}
