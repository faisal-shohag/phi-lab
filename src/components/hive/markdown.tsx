'use client'

// Markdown renderer for Hive posts/replies: GitHub-flavored markdown with
// syntax-highlighted code (rehype-highlight). JavaScript/TypeScript fenced
// blocks get an "Open in Visualizer" affordance that deep-links the exact code
// into the Js Motion lab via the `?code=` lz-string param it already reads
// (src/lib/visualizer/share.ts).
import { memo, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { compressToEncodedURIComponent } from 'lz-string'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'

const JS_LANGS = new Set(['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx'])

interface CodeElementProps {
  className?: string
  children?: ReactNode
}

/** Pull the raw text out of a <code> element's children. */
function codeText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(codeText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return codeText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

function PreBlock({ children }: { children?: ReactNode }) {
  // react-markdown passes the <code> element as the single child of <pre>.
  const codeEl = children as { props?: CodeElementProps } | undefined
  const className = codeEl?.props?.className ?? ''
  const lang = /language-(\w+)/.exec(className)?.[1]?.toLowerCase()
  const raw = codeText(codeEl?.props?.children).replace(/\n$/, '')

  const visualizable = lang && JS_LANGS.has(lang) && raw.trim().length > 0
  const href = visualizable
    ? `/labs/js-motion?code=${compressToEncodedURIComponent(raw)}`
    : null

  return (
    <div className="group relative">
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] font-medium text-amber-100 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/60"
        >
          <Play className="size-3" /> Open in Visualizer
        </a>
      )}
      <pre>{children}</pre>
    </div>
  )
}

function MarkdownImpl({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('hive-md', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: PreBlock,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}

export const HiveMarkdown = memo(MarkdownImpl)
