'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { css as cssLang } from '@codemirror/lang-css'
import { acceptCompletion, autocompletion } from '@codemirror/autocomplete'
import { indentWithTab } from '@codemirror/commands'
import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import {
  abbreviationTracker,
  EmmetKnownSyntax,
  expandAbbreviation,
} from '@emmetio/codemirror6-plugin'

import { editorChromeTheme, syntaxTheme, useIsDarkClass } from '@/components/editor/editor-theme'
import { cn } from '@/lib/utils'

export type PixelLang = 'html' | 'css'

interface PixelEditorProps {
  lang: PixelLang
  value: string
  onChange: (value: string) => void
  /** Take the cursor when this becomes true — on mount, and when this pane becomes the visible one. */
  focused?: boolean
  className?: string
}

/**
 * The HTML/CSS editor.
 *
 * Intentionally much thinner than the JS Motion editor: no breakpoints, no step
 * highlighting, no execution bar. There is nothing to step through — the feedback
 * here is the live preview beside it. Shares the theme so both labs look like the
 * same product.
 *
 * The theme is rebuilt on mode change rather than swapped through a Compartment.
 * The visualizer needs a Compartment because reconfiguring in place preserves its
 * document and undo history mid-trace; this editor has no such state to protect,
 * and `extensions` re-running on a theme flip is not worth the machinery.
 */
export function PixelEditor({ lang, value, onChange, focused, className }: PixelEditorProps) {
  const isDark = useIsDarkClass()
  const ref = useRef<ReactCodeMirrorRef>(null)

  const extensions = useMemo<Extension[]>(
    () => [
      lang === 'html' ? htmlLang() : cssLang(),

      // Emmet. `div.bar>a.logo+nav.links>a*3` then Tab becomes the tree; `w100`
      // in CSS becomes `width: 100px`. This is the thing that actually feels
      // like VS Code for HTML and CSS — the completion popup below is table
      // stakes, this is the part people miss when it is gone.
      //
      // The syntax has to be passed explicitly: CodeMirror exposes no API for a
      // plugin to ask the host what language it is in, so the plugin cannot work
      // it out (see EmmetConfig.syntax). Getting it wrong silently expands CSS
      // abbreviations as HTML.
      // Bisected against a build with this removed: Emmet's source and the
      // language's own merge cleanly, and typing offers both ("Emmet
      // abbreviation" alongside width/max-width). It does not suppress the
      // popup, which was the obvious suspect and the wrong one.
      abbreviationTracker({
        syntax: lang === 'html' ? EmmetKnownSyntax.html : EmmetKnownSyntax.css,
        // The inline part: mark the abbreviation as you type and preview what it
        // will become, so expansion is discoverable rather than folklore.
        mark: true,
        previewEnabled: true,
      }),

      // Ours, not basicSetup's. `basicSetup.autocompletion` takes a boolean and
      // installs `autocompletion()` with zero arguments, so there is no way to
      // configure it through that door — hence `autocompletion: false` below.
      // The completion *sources* already existed: html() and css() wire
      // htmlCompletionSource/cssCompletionSource into language data. This is
      // configuration, not new capability.
      autocompletion({
        activateOnTyping: true,
        // Default is 100ms, which reads as lag on a lab where the whole point is
        // that typing is cheap.
        activateOnTypingDelay: 0,
        icons: true,
        selectOnOpen: true,
      }),

      // Tab, in Prec.highest so it beats the default keymaps, tried in order.
      // Order is the whole design: expanding an abbreviation and accepting a
      // completion both want Tab, and expansion has to win or Emmet is
      // unreachable whenever the popup happens to be open — which, with
      // activateOnTyping, is most of the time you have an abbreviation typed.
      // Falling through to indentWithTab keeps Tab doing its ordinary job the
      // rest of the time.
      Prec.highest(
        keymap.of([
          { key: 'Tab', run: expandAbbreviation },
          { key: 'Tab', run: acceptCompletion },
          indentWithTab,
        ]),
      ),

      editorChromeTheme,
      syntaxTheme(isDark),
    ],
    [lang, isDark],
  )

  /**
   * Take the caret, and put it somewhere worth typing.
   *
   * Nothing in this app has ever focused an editor: you land in Pixel Lab and
   * have to go find the cursor first. Both editors stay mounted (the hidden one
   * keeps its undo history), so only the visible one may take focus — otherwise
   * HTML and CSS fight over the caret.
   *
   * **The end of the document, not the start.** Every challenge's starter CSS
   * opens with a worked example in a block comment, so a caret at position 0 sits
   * *inside* that comment — and CodeMirror, correctly, offers no completions
   * inside a comment. The lab looked like autocomplete was broken when what it
   * was actually doing was refusing to suggest CSS properties in prose. Landing
   * past the comment puts the first keystroke in real code.
   */
  const placeCaret = useCallback(() => {
    const view = ref.current?.view
    if (!view) return
    view.focus()
    view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true })
  }, [])

  useEffect(() => {
    if (!focused) return
    // rAF because CodeMirror's view is attached after paint on mount, and
    // focusing a view that is still display:none silently does nothing.
    const frame = requestAnimationFrame(placeCaret)
    return () => cancelAnimationFrame(frame)
  }, [focused, placeCaret])

  const onCreate = useCallback(() => {
    if (focused) placeCaret()
  }, [focused, placeCaret])

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      onCreateEditor={onCreate}
      extensions={extensions}
      theme="none"
      className={cn('h-full overflow-auto text-[13px]', className)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        // Ours is configured above; basicSetup's cannot be.
        autocompletion: false,
        searchKeymap: false,
        bracketMatching: true,
        closeBrackets: true,
        // Ours binds Tab first, and this one would grab it back.
        defaultKeymap: true,
      }}
    />
  )
}
