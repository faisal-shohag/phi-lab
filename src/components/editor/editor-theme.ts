// Shared CodeMirror theming, used by every editor in the app.
//
// Extracted from components/visualizer/code-editor.tsx when Pixel Lab needed a
// second editor. What lives here is the part that has nothing to do with any one
// lab: the editor chrome, the syntax palettes, and the light/dark switch. The JS
// Motion visualizer keeps its own layer on top for execution bars, ghost text
// and breakpoint gutters — those are its features, not editor furniture.
//
// Compose in this order, so a lab's own rules win:
//   extensions = [editorChromeTheme, syntaxTheme(isDark), ...labSpecific]
'use client'

import { useEffect, useState } from 'react'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/** Font, scroller, gutters, padding — the furniture every editor wants. */
export const editorChromeTheme = EditorView.theme({
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
  '.cm-error-line': {
    backgroundColor: 'rgba(244, 63, 94, 0.14)',
    boxShadow: 'inset 3px 0 0 0 #f43f5e',
  },
})

interface ChromePalette {
  gutterText: string
  gutterActiveText: string
  selection: string
  cursor: string
}

const lightChrome: ChromePalette = {
  gutterText: '#94a3b8',
  gutterActiveText: '#0f172a',
  selection: 'rgba(245, 158, 11, 0.25)',
  cursor: '#0f172a',
}

const darkChrome: ChromePalette = {
  gutterText: '#64748b',
  gutterActiveText: '#f1f5f9',
  selection: 'rgba(245, 158, 11, 0.30)',
  cursor: '#f1f5f9',
}

function chromeTheme(p: ChromePalette, dark: boolean): Extension {
  return EditorView.theme(
    {
      '.cm-gutters': { backgroundColor: 'transparent', color: p.gutterText },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: p.gutterActiveText },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: `${p.selection} !important`,
      },
      '.cm-cursor': { borderLeftColor: p.cursor },
    },
    { dark },
  )
}

// The app's slate/amber palette. Lezer tags are language-agnostic, so the same
// definitions colour JavaScript, HTML and CSS.
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
  // Markup and CSS. Tag names read as keywords, attributes as properties, and
  // selectors take the class colour — so an editor holding HTML or CSS looks
  // like the same product as the one holding JavaScript.
  { tag: [t.tagName], color: '#c026d3', fontWeight: '600' },
  { tag: [t.attributeName], color: '#d97706' },
  { tag: [t.attributeValue], color: '#059669' },
  { tag: [t.angleBracket, t.definitionOperator], color: '#94a3b8' },
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
  { tag: [t.tagName], color: '#e879f9', fontWeight: '600' },
  { tag: [t.attributeName], color: '#fbbf24' },
  { tag: [t.attributeValue], color: '#34d399' },
  { tag: [t.angleBracket, t.definitionOperator], color: '#64748b' },
])

export const lightSyntaxTheme: Extension = [chromeTheme(lightChrome, false), syntaxHighlighting(lightSyntax)]
export const darkSyntaxTheme: Extension = [chromeTheme(darkChrome, true), syntaxHighlighting(darkSyntax)]

/** The theme for the current mode. Pair with a Compartment to swap it in place. */
export function syntaxTheme(dark: boolean): Extension {
  return dark ? darkSyntaxTheme : lightSyntaxTheme
}

/**
 * Watch the `dark` class on <html> directly: the theme can be flipped either by
 * next-themes or by AnimatedThemeToggler (which mutates the class without going
 * through next-themes), so useTheme() alone would miss changes.
 */
export function useIsDarkClass(): boolean {
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
