// Helpers for turning ValueSnapshot / HeapSnapshot data into something the UI
// can render. The interpreter stores values as either primitives or refs into
// a per-step heap; these functions resolve those refs.

import type { HeapSnapshot, Primitive, ValueSnapshot } from './types'

export function heapMap(heap: HeapSnapshot[]): Map<number, HeapSnapshot> {
  const m = new Map<number, HeapSnapshot>()
  for (const h of heap) m.set(h.id, h)
  return m
}

export type ResolvedKind = 'primitive' | 'array' | 'object' | 'function'

export interface ResolvedValue {
  kind: ResolvedKind
  // For primitives.
  primitive?: Primitive
  // For refs — the heap id (so the UI can key/highlight it).
  refId?: number
  heap?: HeapSnapshot
}

export function resolveValue(v: ValueSnapshot, heap: Map<number, HeapSnapshot>): ResolvedValue {
  if (v.t === 'prim') return { kind: 'primitive', primitive: v.v }
  const h = heap.get(v.id)
  const kind: ResolvedKind = h?.kind ?? 'object'
  return { kind, refId: v.id, heap: h }
}

// A short one-line label for a value, used for inline chips / ghost text.
export function shortLabel(v: ValueSnapshot, heap: Map<number, HeapSnapshot>): string {
  if (v.t === 'prim') return formatPrimitive(v.v)
  const h = heap.get(v.id)
  if (!h) return '·'
  if (h.kind === 'array') return `[${(h.cells ?? []).map((c) => shortLabel(c, heap)).join(', ')}]`
  if (h.kind === 'function') return `ƒ ${h.label ?? ''}`
  return `{${(h.fields ?? []).map((f) => `${f.key}: ${shortLabel(f.value, heap)}`).join(', ')}}`
}

export function formatPrimitive(v: Primitive): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
}

// Tailwind text color class for a primitive value, by type.
export function primitiveColor(v: Primitive): string {
  if (typeof v === 'number') return 'text-sky-600 dark:text-sky-400'
  if (typeof v === 'boolean') return 'text-fuchsia-600 dark:text-fuchsia-400'
  if (v === null || v === undefined) return 'text-muted-foreground'
  return 'text-emerald-600 dark:text-emerald-400'
}
