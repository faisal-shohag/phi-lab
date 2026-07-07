'use client'

// Anon-only nudge shown in the Js Motion navbar: an "Earn XP" chip whose popover
// auto-opens once to explain that signing in unlocks XP, badges and levels.
// Renders nothing for signed-in learners (their avatar + XP ring show instead).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverTrigger, PopoverContent, PopoverTitle, PopoverDescription,
} from '@/components/ui/popover'

const DISMISS_KEY = 'phi.xp-hint.dismissed'

interface XpHintProps {
  /** Where to send the learner back after signing in. */
  redirect?: string
}

export function XpHint({ redirect = '/labs/js-motion' }: XpHintProps) {
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)

  // Auto-open once per browser, shortly after mount, for logged-out learners.
  useEffect(() => {
    if (isPending || session?.user) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // ignore storage errors (private mode etc.)
    }
    if (dismissed) return
    const t = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(t)
  }, [isPending, session?.user])

  if (isPending || session?.user) return null

  function dismiss() {
    setOpen(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Earn XP
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Turn practice into progress
        </PopoverTitle>
        <PopoverDescription className="mt-1 text-sm text-muted-foreground">
          Flip on <span className="font-medium text-foreground">Quiz</span> and predict what each line
          prints. Sign in to earn XP for correct answers, unlock badges, and level up as you learn.
        </PopoverDescription>
        <div className="mt-3 flex gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link href={`/sign-in?redirect=${encodeURIComponent(redirect)}`}>Sign in to earn XP</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
