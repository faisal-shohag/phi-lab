'use client'

import { motion } from 'framer-motion'
import { Loader2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supportCategoryById } from '@/lib/support/prompt'

interface WaitingScreenProps {
  position: number
  category: string | null
  onLeave: () => void
}

export function WaitingScreen({ position, category, onLeave }: WaitingScreenProps) {
  const label = supportCategoryById(category ?? '')?.label
  const inLine = position > 0
  const etaMin = inLine ? position * 10 : 0

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-3xl border-2 border-border bg-card p-8 shadow-sm">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/30" />
          <span className="absolute inset-2 animate-ping rounded-full bg-pink-400/30 [animation-delay:300ms]" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-lg">
            <Users className="h-7 w-7" />
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold">You’re in the queue</h1>

        {inLine ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              All 3 support spots are busy right now. We’ll connect you the moment one opens up — keep this tab open.
            </p>
            <div className="mt-6 flex items-center justify-center gap-6">
              <div>
                <div className="text-4xl font-bold tabular-nums text-rose-500">#{position}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">In line</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-4xl font-bold tabular-nums">~{etaMin}m</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">Est. wait</div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Connecting you now…
          </p>
        )}

        {label && (
          <p className="mt-6 text-xs text-muted-foreground">
            Topic: <span className="font-medium text-foreground">{label}</span>
          </p>
        )}

        <Button variant="ghost" size="sm" className="mt-6 text-muted-foreground" onClick={onLeave}>
          <X className="h-4 w-4" /> Leave queue
        </Button>
      </motion.div>
    </div>
  )
}
