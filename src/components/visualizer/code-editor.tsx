'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { linter, type Diagnostic } from '@codemirror/lint'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  gutter,
  keymap,
} from '@codemirror/view'
import { Compartment, type EditorState, type Extension, Prec, StateEffect, StateField } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { getParseError } from '@/lib/visualizer/interpreter'
import type { StepKind } from '@/lib/visualizer/types'

// Everything the editor needs to visualize the current execution step.
export interface EditorHighlight {
  // 1-indexed line to highlight as "currently executing".
  activeLine?: number
  kind?: StepKind
  // While inside a function call: the function's source range to tint.
  fnStart?: number
  fnEnd?: number
  // The call-site line (marked while calling / inside the function).
  callLine?: number
  // Ghost text appended after the active line (live locals, debugger-style).
  ghostText?: string
  // Ghost text appended after the function signature line (param bindings).
  signatureText?: string
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  highlight?: EditorHighlight | null
  breakpoints: Set<number>
  onToggleBreakpoint: (line: number) => void
  readOnly?: boolean
}

// Map step kinds onto a small set of highlight color groups.
function kindGroup(kind?: StepKind): string {
  switch (kind) {
    case 'assign': return 'assign'
    case 'declare': return 'declare'
    case 'condition':
    case 'branch': return 'cond'
    case 'loop-start':
    case 'loop-check':
    case 'loop-iter':
    case 'loop-end': return 'loop'
    case 'read': return 'read'
    case 'write': return 'write'
    case 'call':
    case 'return':
    case 'enter': return 'call'
    default: return 'out'
  }
}

// ---------------------------------------------------------------------------
// Execution-highlight state field
// ---------------------------------------------------------------------------

const setHighlightEffect = StateEffect.define<EditorHighlight | null>()

class GhostWidget extends WidgetType {
  constructor(readonly text: string, readonly cls: string) { super() }
  eq(other: GhostWidget) { return other.text === this.text && other.cls === this.cls }
  toDOM() {
    const span = document.createElement('span')
    span.className = this.cls
    span.textContent = this.text
    return span
  }
  ignoreEvent() { return true }
}

function buildHighlightDeco(state: EditorState, h: EditorHighlight | null): DecorationSet {
  if (!h) return Decoration.none
  const ranges: { from: number; deco: Decoration }[] = []
  const lines = state.doc.lines

  const fnStart = h.fnStart && h.fnStart >= 1 && h.fnStart <= lines ? h.fnStart : undefined
  const fnEnd = fnStart && h.fnEnd ? Math.min(h.fnEnd, lines) : undefined
  if (fnStart && fnEnd) {
    for (let ln = fnStart; ln <= fnEnd; ln++) {
      ranges.push({ from: state.doc.line(ln).from, deco: Decoration.line({ class: 'cm-fn-region' }) })
    }
  }
  if (h.callLine && h.callLine >= 1 && h.callLine <= lines && h.callLine !== h.activeLine) {
    ranges.push({ from: state.doc.line(h.callLine).from, deco: Decoration.line({ class: 'cm-callsite' }) })
  }
  // The active-line background itself is drawn by execBarPlugin (a single
  // persistent element that slides between lines); only the ghost widget is
  // a decoration here.
  if (h.activeLine && h.activeLine >= 1 && h.activeLine <= lines && h.ghostText) {
    const line = state.doc.line(h.activeLine)
    ranges.push({
      from: line.to,
      deco: Decoration.widget({ widget: new GhostWidget(h.ghostText, 'cm-ghost'), side: 1 }),
    })
  }
  if (h.signatureText && fnStart && fnStart !== h.activeLine) {
    ranges.push({
      from: state.doc.line(fnStart).to,
      deco: Decoration.widget({ widget: new GhostWidget(h.signatureText, 'cm-ghost cm-ghost-sig'), side: 1 }),
    })
  }
  return Decoration.set(
    ranges.map((r) => r.deco.range(r.from)),
    true,
  )
}

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setHighlightEffect)) deco = buildHighlightDeco(tr.state, e.value)
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

// Raw highlight value, kept in state so the bar plugin can read it.
const execHighlightState = StateField.define<EditorHighlight | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightEffect)) value = e.value
    }
    return value
  },
})

// A single absolutely-positioned element behind the text that marks the
// executing line. Because it is one persistent DOM node, CSS transitions
// make it glide smoothly from line to line instead of jumping.
const execBarPlugin = ViewPlugin.fromClass(
  class {
    bar: HTMLDivElement
    constructor(readonly view: EditorView) {
      this.bar = document.createElement('div')
      this.bar.className = 'cm-exec-bar'
      this.bar.style.opacity = '0'
      view.scrollDOM.appendChild(this.bar)
      view.requestMeasure({ read: () => this.position() })
    }
    update(u: ViewUpdate) {
      if (
        u.docChanged ||
        u.geometryChanged ||
        u.viewportChanged ||
        u.transactions.some((tr) => tr.effects.some((e) => e.is(setHighlightEffect)))
      ) {
        u.view.requestMeasure({ read: () => this.position() })
      }
    }
    position() {
      const h = this.view.state.field(execHighlightState)
      const ln = h?.activeLine
      if (!ln || ln < 1 || ln > this.view.state.doc.lines) {
        this.bar.style.opacity = '0'
        return
      }
      const block = this.view.lineBlockAt(this.view.state.doc.line(ln).from)
      const scroller = this.view.scrollDOM
      const scrollRect = scroller.getBoundingClientRect()
      const contentRect = this.view.contentDOM.getBoundingClientRect()
      this.bar.className = `cm-exec-bar cm-exec-${kindGroup(h?.kind)}`
      this.bar.style.opacity = '1'
      this.bar.style.top = `${block.top + this.view.documentTop - scrollRect.top + scroller.scrollTop}px`
      this.bar.style.height = `${block.height}px`
      this.bar.style.left = `${contentRect.left - scrollRect.left + scroller.scrollLeft}px`
      this.bar.style.width = `${contentRect.width}px`
    }
    destroy() {
      this.bar.remove()
    }
  },
)

// ---------------------------------------------------------------------------
// Breakpoint gutter
// ---------------------------------------------------------------------------

const setBreakpointsEffect = StateEffect.define<Set<number>>()

const breakpointsField = StateField.define<Set<number>>({
  create: () => new Set<number>(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setBreakpointsEffect)) value = e.value
    }
    return value
  },
})

const bpMarker = new (class extends GutterMarker {
  toDOM() {
    const dot = document.createElement('div')
    dot.className = 'cm-bp-dot'
    return dot
  }
})()

// ---------------------------------------------------------------------------
// Parse-error squiggles
// ---------------------------------------------------------------------------

const parseLinter = linter(
  (view): Diagnostic[] => {
    const err = getParseError(view.state.doc.toString())
    if (!err) return []
    const line = view.state.doc.line(Math.max(1, Math.min(err.line, view.state.doc.lines)))
    const from = Math.min(line.from + err.column, line.to)
    const to = Math.max(from, Math.min(from + 1, line.to))
    return [{ from, to, severity: 'error', message: err.message }]
  },
  { delay: 300 },
)

// ---------------------------------------------------------------------------
// Themes — light and dark palettes matching the app's slate/amber design.
// ---------------------------------------------------------------------------

const baseTheme = EditorView.theme({
  '&': { fontSize: '13px', height: '100%', backgroundColor: 'transparent' },
  '.cm-scroller': {
    fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.6',
    position: 'relative',
  },
  '.cm-content': { paddingTop: '8px', paddingBottom: '8px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { border: 'none', userSelect: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { paddingLeft: '6px', paddingRight: '10px', minWidth: '32px' },
  '.cm-bp-gutter': { width: '14px', cursor: 'pointer' },
  '.cm-bp-dot': {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    backgroundColor: '#f43f5e',
    marginTop: '6px',
    marginLeft: '2px',
    boxShadow: '0 0 4px rgba(244, 63, 94, 0.6)',
  },
  '.cm-ghost': {
    fontStyle: 'italic',
    fontSize: '11px',
    paddingLeft: '1.5em',
    opacity: '0.8',
    pointerEvents: 'none',
  },
  '.cm-exec-bar': {
    position: 'absolute',
    zIndex: '-1',
    pointerEvents: 'none',
    borderRadius: '2px',
    transition:
      'top 0.22s cubic-bezier(0.4, 0, 0.2, 1), height 0.22s cubic-bezier(0.4, 0, 0.2, 1), ' +
      'left 0.22s ease, width 0.22s ease, background-color 0.18s ease, box-shadow 0.18s ease, opacity 0.15s ease',
  },
})

interface Palette {
  gutterText: string
  gutterActiveText: string
  selection: string
  ghost: string
  fnRegion: string
  callsiteBorder: string
  exec: Record<string, { bg: string; border: string }>
}

function execTheme(p: Palette, dark: boolean): Extension {
  const execRules: Record<string, Record<string, string>> = {}
  for (const [group, c] of Object.entries(p.exec)) {
    execRules[`.cm-exec-${group}`] = {
      backgroundColor: c.bg,
      boxShadow: `inset 3px 0 0 0 ${c.border}`,
    }
  }
  return EditorView.theme(
    {
      '.cm-gutters': { backgroundColor: 'transparent', color: p.gutterText },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: p.gutterActiveText },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: `${p.selection} !important`,
      },
      '.cm-cursor': { borderLeftColor: dark ? '#f1f5f9' : '#0f172a' },
      '.cm-ghost': { color: p.ghost },
      '.cm-fn-region': { backgroundColor: p.fnRegion },
      '.cm-callsite': { boxShadow: `inset 3px 0 0 0 ${p.callsiteBorder}` },
      ...execRules,
    },
    { dark },
  )
}

const lightPalette: Palette = {
  gutterText: '#94a3b8',
  gutterActiveText: '#0f172a',
  selection: 'rgba(245, 158, 11, 0.25)',
  ghost: '#b45309',
  fnRegion: 'rgba(20, 184, 166, 0.07)',
  callsiteBorder: 'rgba(245, 158, 11, 0.55)',
  exec: {
    assign: { bg: 'rgba(245, 158, 11, 0.16)', border: '#f59e0b' },
    declare: { bg: 'rgba(16, 185, 129, 0.14)', border: '#10b981' },
    cond: { bg: 'rgba(217, 70, 239, 0.12)', border: '#d946ef' },
    loop: { bg: 'rgba(139, 92, 246, 0.13)', border: '#8b5cf6' },
    read: { bg: 'rgba(14, 165, 233, 0.14)', border: '#0ea5e9' },
    write: { bg: 'rgba(244, 63, 94, 0.13)', border: '#f43f5e' },
    call: { bg: 'rgba(20, 184, 166, 0.15)', border: '#14b8a6' },
    out: { bg: 'rgba(100, 116, 139, 0.13)', border: '#64748b' },
  },
}

const darkPalette: Palette = {
  gutterText: '#64748b',
  gutterActiveText: '#f1f5f9',
  selection: 'rgba(245, 158, 11, 0.30)',
  ghost: '#fbbf24',
  fnRegion: 'rgba(20, 184, 166, 0.10)',
  callsiteBorder: 'rgba(251, 191, 36, 0.55)',
  exec: {
    assign: { bg: 'rgba(245, 158, 11, 0.20)', border: '#fbbf24' },
    declare: { bg: 'rgba(16, 185, 129, 0.18)', border: '#34d399' },
    cond: { bg: 'rgba(217, 70, 239, 0.17)', border: '#e879f9' },
    loop: { bg: 'rgba(139, 92, 246, 0.18)', border: '#a78bfa' },
    read: { bg: 'rgba(14, 165, 233, 0.18)', border: '#38bdf8' },
    write: { bg: 'rgba(244, 63, 94, 0.18)', border: '#fb7185' },
    call: { bg: 'rgba(20, 184, 166, 0.19)', border: '#2dd4bf' },
    out: { bg: 'rgba(100, 116, 139, 0.18)', border: '#94a3b8' },
  },
}

const lightSyntax = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: '#c026d3', fontWeight: '600' },
  { tag: [t.comment], color: '#94a3b8', fontStyle: 'italic' },
  { tag: [t.number, t.bool], color: '#0284c7' },
  { tag: [t.string, t.special(t.string)], color: '#059669' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#d97706' },
  { tag: [t.punctuation, t.operator], color: '#64748b' },
  { tag: [t.variableName], color: '#0f172a' },
  { tag: [t.propertyName], color: '#334155' },
  { tag: [t.className, t.standard(t.variableName)], color: '#8b5cf6' },
  { tag: [t.null, t.atom], color: '#c026d3' },
])

const darkSyntax = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: '#e879f9', fontWeight: '600' },
  { tag: [t.comment], color: '#64748b', fontStyle: 'italic' },
  { tag: [t.number, t.bool], color: '#38bdf8' },
  { tag: [t.string, t.special(t.string)], color: '#34d399' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#fbbf24' },
  { tag: [t.punctuation, t.operator], color: '#94a3b8' },
  { tag: [t.variableName], color: '#e2e8f0' },
  { tag: [t.propertyName], color: '#cbd5e1' },
  { tag: [t.className, t.standard(t.variableName)], color: '#a78bfa' },
  { tag: [t.null, t.atom], color: '#e879f9' },
])

const lightTheme: Extension = [execTheme(lightPalette, false), syntaxHighlighting(lightSyntax)]
const darkTheme: Extension = [execTheme(darkPalette, true), syntaxHighlighting(darkSyntax)]

// Theme lives in a compartment so switching light/dark reconfigures the live
// editor in place — no re-creation, document and undo history untouched.
const themeCompartment = new Compartment()

// Watch the `dark` class on <html> directly: the theme can be flipped either
// by next-themes or by AnimatedThemeToggler (which mutates the class without
// going through next-themes), so useTheme() alone would miss changes.
function useIsDarkClass(): boolean {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains('dark'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CodeEditor({
  value,
  onChange,
  onRun,
  highlight,
  breakpoints,
  onToggleBreakpoint,
  readOnly,
}: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const isDark = useIsDarkClass()

  const onRunRef = useRef(onRun)
  const onToggleBpRef = useRef(onToggleBreakpoint)
  useEffect(() => {
    onRunRef.current = onRun
    onToggleBpRef.current = onToggleBreakpoint
  })

  const extensions = useMemo<Extension[]>(() => {
    // The ref reads below run inside CodeMirror callbacks (gutter clicks, the
    // run keymap), which fire long after render — the stable-callback pattern.
    /* eslint-disable react-hooks/refs */
    const bpGutter = gutter({
      class: 'cm-bp-gutter',
      lineMarker(view, line) {
        const ln = view.state.doc.lineAt(line.from).number
        return view.state.field(breakpointsField).has(ln) ? bpMarker : null
      },
      lineMarkerChange: (update) =>
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setBreakpointsEffect))),
      domEventHandlers: {
        mousedown(view, line) {
          onToggleBpRef.current(view.state.doc.lineAt(line.from).number)
          return true
        },
      },
    })
    const runKeymap = Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRunRef.current()
            return true
          },
        },
      ]),
    )
    /* eslint-enable react-hooks/refs */
    return [
      javascript(),
      baseTheme,
      themeCompartment.of([]),
      highlightField,
      execHighlightState,
      execBarPlugin,
      breakpointsField,
      bpGutter,
      parseLinter,
      runKeymap,
    ]
  }, [])

  // Swap the light/dark palette in place when the app theme changes.
  useEffect(() => {
    const view = editorRef.current?.view
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(isDark ? darkTheme : lightTheme),
    })
  }, [isDark])

  // Push the execution highlight into the editor and keep the active line
  // scrolled into view.
  useEffect(() => {
    const view = editorRef.current?.view
    if (!view) return
    const effects: StateEffect<unknown>[] = [setHighlightEffect.of(highlight ?? null)]
    const line = highlight?.activeLine
    if (line && line >= 1 && line <= view.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'center' }))
    }
    view.dispatch({ effects })
  }, [highlight])

  // Push breakpoint changes into the gutter.
  useEffect(() => {
    const view = editorRef.current?.view
    if (!view) return
    view.dispatch({ effects: setBreakpointsEffect.of(new Set(breakpoints)) })
  }, [breakpoints])

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      height="100%"
      style={{ height: '100%' }}
      theme="none"
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        autocompletion: false,
        searchKeymap: false,
      }}
      onCreateEditor={(view) => {
        view.dispatch({
          effects: [
            themeCompartment.reconfigure(isDark ? darkTheme : lightTheme),
            setHighlightEffect.of(highlight ?? null),
            setBreakpointsEffect.of(new Set(breakpoints)),
          ],
        })
      }}
    />
  )
}
