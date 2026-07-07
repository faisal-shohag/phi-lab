'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Sparkles, Download, Link2, RefreshCw, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  ANALOGY_LANGUAGES, SUGGESTED_CONCEPTS, type AnalogyCardData, type AnalogyLanguage,
} from '@/lib/analogies/concepts'
import { downloadAnalogyCard } from '@/lib/analogies/draw-card'
import { refreshXp } from '@/lib/gamification/use-xp'
import { AnalogyCard } from '@/components/analogies/analogy-card'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resolveErrorCopy } from '@/lib/interview/errors'
import { cn } from '@/lib/utils'

export function AnalogiesLab({ initialDeck }: { initialDeck: AnalogyCardData[] }) {
  const [concept, setConcept] = useState('')
  const [language, setLanguage] = useState<AnalogyLanguage>('en')
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState<AnalogyCardData | null>(initialDeck[0] ?? null)
  const [deck, setDeck] = useState<AnalogyCardData[]>(initialDeck)
  const [copied, setCopied] = useState(false)

  async function generate(topic: string) {
    const c = topic.trim()
    if (!c || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/analogies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: c, language }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(resolveErrorCopy(data?.error).title, { description: data?.message })
        return
      }
      const data = (await res.json()) as AnalogyCardData
      setCard(data)
      setDeck((d) => [data, ...d])
      void refreshXp()
    } catch {
      toast.error('Could not generate analogy', { description: 'Check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!card?.id) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/analogies/${card.id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function remove(id: string) {
    setDeck((d) => d.filter((c) => c.id !== id))
    if (card?.id === id) setCard(null)
    try {
      await fetch(`/api/analogies/${id}`, { method: 'DELETE' })
    } catch {
      // best-effort; the row may remain but is out of the local deck
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Rickshaw Analogies</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Any concept, explained like home</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AnimatedThemeToggler />
            <XpBadge />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Left: generator + deck */}
        <div>
          <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
            <label className="text-sm font-semibold">What should I explain?</label>
            <div className="mt-2 flex gap-2">
              <Input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void generate(concept) }}
                placeholder="e.g. closures, the event loop, caching…"
                disabled={loading}
              />
              <Button onClick={() => void generate(concept)} disabled={loading || !concept.trim()} className="bg-linear-to-r from-amber-500 to-rose-500">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="hidden sm:inline">Generate</span>
              </Button>
            </div>

            {/* Language */}
            <div className="mt-3 flex items-center gap-1.5">
              {ANALOGY_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    language === l.id ? 'border-transparent bg-foreground text-background' : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Suggestions */}
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Try one</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CONCEPTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setConcept(s); void generate(s) }}
                    disabled={loading}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-amber-400 hover:bg-accent disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deck */}
          {deck.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Your deck ({deck.length})</h2>
              <div className="space-y-2">
                {deck.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                      card?.id === c.id ? 'border-amber-400 bg-accent' : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <button onClick={() => setCard(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.concept}</span>
                      </span>
                    </button>
                    <button onClick={() => c.id && void remove(c.id)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: current card + actions */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <AnimatePresence mode="wait">
            {card ? (
              <motion.div key={card.id ?? 'card'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AnalogyCard data={card} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void downloadAnalogyCard(card)}>
                    <Download className="h-4 w-4" /> PNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyLink} disabled={!card.id}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void generate(card.concept)} disabled={loading}>
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Regenerate
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 text-center"
              >
                <div className="text-4xl">🛺</div>
                <p className="mt-3 text-sm font-semibold">Your analogy card appears here</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Type a concept or tap a suggestion. We&apos;ll explain it with an everyday scene you can share.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
