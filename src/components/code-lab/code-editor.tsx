'use client'

import { useSyncExternalStore } from 'react'
import Editor, { type BeforeMount } from '@monaco-editor/react'
import { useIsDarkClass } from '@/components/editor/editor-theme'
import { Spinner } from '@/components/ui/spinner'
import {
  getEditorSettings,
  getServerEditorSettings,
  subscribeEditorSettings,
} from '@/lib/code-lab/settings'
import type { CodeLanguage } from '@/lib/code-lab/types'

const DARK_THEME = 'code-lab-dark'
const LIGHT_THEME = 'code-lab-light'

// Define the themes in beforeMount, i.e. BEFORE the editor is created and the
// `theme` prop is first applied. Defining them in onMount (after creation) meant
// that on a reload already in dark mode, `code-lab-dark` didn't exist yet when
// Monaco set it — it fell back to light `vs`, and since `dark` never changed
// again the theme was never re-applied. So the editor was stuck light.
const setup: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0a0a0a',
      'editorGutter.background': '#0a0a0a',
      'editor.lineHighlightBackground': '#ffffff0a',
      'editorLineNumber.foreground': '#525252',
    },
  })
  monaco.editor.defineTheme(LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editorGutter.background': '#ffffff',
      'editorLineNumber.foreground': '#a3a3a3',
    },
  })

  // Grade on the exact code typed — don't let the built-in TS service flag
  // missing DOM/node globals as errors that scare learners.
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  })
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    noEmit: true,
  })
}

export function CodeEditor({
  language,
  value,
  onChange,
}: {
  language: CodeLanguage
  value: string
  onChange: (v: string) => void
}) {
  // Watch the .dark class directly: AnimatedThemeToggler flips it without going
  // through next-themes, so useTheme() would miss the change until a reload.
  const dark = useIsDarkClass()
  const settings = useSyncExternalStore(subscribeEditorSettings, getEditorSettings, getServerEditorSettings)

  return (
    <Editor
      language={language === 'TYPESCRIPT' ? 'typescript' : 'javascript'}
      theme={dark ? DARK_THEME : LIGHT_THEME}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      beforeMount={setup}
      loading={<Spinner />}
      options={{
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        fontLigatures: settings.fontLigatures,
        tabSize: settings.tabSize,
        minimap: { enabled: settings.minimap },
        wordWrap: settings.wordWrap ? 'on' : 'off',
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        fixedOverflowWidgets: true,
      }}
    />
  )
}
