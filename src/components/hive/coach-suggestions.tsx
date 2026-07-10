'use client'

// Pre-post coach panel. Asks the AI how answerable the draft is, then shows a
// score and a short list of concrete fixes. It never answers the question —
// good questions get better answers, so this pays for itself.
import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Wand2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CoachResult {
  quality: number
  suggestions: { kind: string; text: string }[]
  improvedTitle?: string
}

const KIND_LABEL: Record<string, string> = {
  add_error: 'Add the error',
  add_code: 'Add your code',
  clarify_goal: 'Clarify the goal',
  shorten: 'Trim it down',
  title: 'Sharpen the title',
}

export function CoachSuggestions({
  title,
  body,
  onApplyTitle,
}: {
  title: string
  body: string
  onApplyTitle: (t: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CoachResult | null>(null)

  async function run() {
    if (title.trim().length < 5 || body.trim().length < 10) {
      toast.error('Write a bit more before asking for feedback.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/hive/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not review your draft.')
        return
      }
      setResult(data)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const scoreTone =
    !result ? '' : result.quality >= 75 ? 'text-emerald-600' : result.quality >= 50 ? 'text-amber-600' : 'text-rose-600'

  return (
    <div className="hive-glass rounded-xl border-dashed p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Ask the Hive to review your question first</p>
          <p className="text-xs text-muted-foreground">
            Clearer questions get better answers — and fewer escalations.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="hive-btn-soft rounded-full" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Review
        </Button>
      </div>

      {result && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-sm">
            Answerability:{' '}
            <span className={cn('font-semibold', scoreTone)}>{result.quality}/100</span>
          </p>

          {result.suggestions.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" /> This question is ready to post.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {result.suggestions.map((s, i) => (
                <li key={i} className="text-sm">
                  <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                    {KIND_LABEL[s.kind] ?? s.kind}
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
          )}

          {result.improvedTitle && result.improvedTitle.trim() && result.improvedTitle !== title && (
            <div className="flex items-start gap-2 rounded-md bg-muted/60 p-2 text-sm">
              <span className="flex-1">
                <span className="text-xs text-muted-foreground">Suggested title:</span>{' '}
                {result.improvedTitle}
              </span>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => onApplyTitle(result.improvedTitle!)}
              >
                Use it
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
