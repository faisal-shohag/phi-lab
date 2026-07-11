'use client'

import { Clock, Heart, Flame, Flag, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { RESUME_TIME_COST, RESUME_LIFE_COST } from '@/lib/visualizer/challenge'
import { useArenaJuice } from './arena-fx'

interface Props {
  kind: 'time' | 'life'
  xp: number
  busy?: boolean
  calm?: boolean
  onBuy: () => void
  onDecline: () => void
}

export function ChallengeRescue({ kind, xp, busy, calm, onBuy, onDecline }: Props) {
  const juice = useArenaJuice(calm)
  const cost = kind === 'time' ? RESUME_TIME_COST : RESUME_LIFE_COST
  const canAfford = xp >= cost
  const Icon = kind === 'time' ? Clock : Heart

  const title = kind === 'time' ? "Time's up!" : 'Out of tries!'
  const perk =
    kind === 'time'
      ? <>+5:00 on the clock <span className="text-muted-foreground">and</span> +1 life <Heart className="inline h-3.5 w-3.5 fill-rose-500 text-rose-500" /></>
      : <>+1 life <Heart className="inline h-3.5 w-3.5 fill-rose-500 text-rose-500" /> — the clock keeps running</>

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={juice ? { scale: 0.85, y: 12, opacity: 0 } : { opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-amber-400 bg-card text-center shadow-2xl"
      >
        <div className="flex flex-col items-center gap-2 bg-linear-to-b from-amber-500/15 to-transparent px-6 py-6">
          <motion.div
            animate={juice ? { scale: [1, 1.12, 1] } : undefined}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 to-orange-600"
          >
            <Icon className="h-7 w-7 text-white" />
          </motion.div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-sm text-muted-foreground">Keep fighting for <strong className="text-foreground">−{cost} XP</strong> — {perk}</p>
          <p className="text-[11px] text-muted-foreground">Balance: {xp} XP</p>
        </div>

        <div className="flex gap-2 border-t p-3">
          <button onClick={onDecline} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">
            <Flag className="h-3.5 w-3.5" /> Give up
          </button>
          <button
            onClick={onBuy}
            disabled={busy || !canAfford}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white',
              busy || !canAfford ? 'bg-muted-foreground/40 cursor-not-allowed' : 'bg-linear-to-r from-amber-500 to-orange-600 hover:opacity-90 shadow-lg shadow-amber-500/30',
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            {!canAfford ? `Need ${cost} XP` : kind === 'time' ? `Resume (−${cost})` : `Buy a life (−${cost})`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
