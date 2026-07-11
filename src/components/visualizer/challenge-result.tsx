'use client'

import { useState } from 'react'
import { Trophy, Skull, Sparkles, Code2, Download, Link2, Share2, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SubmitResult } from './challenge-setup'

interface Props {
  result: SubmitResult
  stake: number
  onNew: () => void
  onExit: () => void
}

export function ChallengeResult({ result, stake, onNew, onExit }: Props) {
  const won = result.status === 'won'
  const [showSolution, setShowSolution] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = won && result.attemptId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/labs/js-motion/challenge/${result.attemptId}`
    : ''
  const imgUrl = shareUrl ? `${shareUrl}/opengraph-image` : ''

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { toast.error('Could not copy the link') }
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = 'js-motion-victory.png'
    a.target = '_blank'
    a.click()
  }
  const nativeShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'I won a Js Motion challenge!', url: shareUrl })
      else await copyLink()
    } catch { /* user cancelled */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className={cn(
          'w-full max-w-sm overflow-hidden rounded-2xl border-2 bg-card text-center shadow-2xl',
          won ? 'border-emerald-400' : 'border-rose-500',
        )}
      >
        <div className={cn('flex flex-col items-center gap-2 px-6 py-6', won ? 'bg-linear-to-b from-emerald-500/15 to-transparent' : 'bg-linear-to-b from-rose-500/15 to-transparent')}>
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', won ? 'bg-linear-to-br from-emerald-400 to-teal-600' : 'bg-linear-to-br from-rose-500 to-red-700')}>
            {won ? <Trophy className="h-7 w-7 text-white" /> : <Skull className="h-7 w-7 text-white" />}
          </div>
          <h2 className="text-xl font-black">{won ? 'Victory!' : result.reason === 'timeout' ? "Time's up!" : 'Challenge lost'}</h2>
          <p className="text-sm text-muted-foreground">{result.passed}/{result.total} hidden tests passed</p>
          <div className={cn('mt-1 font-mono text-2xl font-black', won ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {won ? `+${result.xpDelta}` : `−${stake}`} XP
          </div>
          {won && result.winStreak && result.winStreak > 1 && (
            <div className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
              🔥 {result.winStreak}-win streak{result.multiplier && result.multiplier > 1 ? ` · ${result.multiplier}× bonus` : ''}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Balance: {result.balance} XP</p>
          {won && result.xpDelta > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><Sparkles className="h-3 w-3" /> stake returned + bonus</p>
          )}
        </div>

        {/* Reveal solution (winner-only) */}
        {won && result.referenceSolution && (
          <div className="border-t px-4 py-2 text-left">
            <button onClick={() => setShowSolution((s) => !s)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Code2 className="h-3.5 w-3.5" /> {showSolution ? 'Hide' : 'Reveal'} a solution
            </button>
            {showSolution && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-snug">{result.referenceSolution}</pre>
            )}
          </div>
        )}

        {/* Share card (winner-only) */}
        {won && shareUrl && (
          <div className="flex items-center justify-center gap-2 border-t px-4 py-2.5">
            <button onClick={download} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted"><Download className="h-3.5 w-3.5" /> Card</button>
            <button onClick={copyLink} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Link'}</button>
            <button onClick={nativeShare} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted"><Share2 className="h-3.5 w-3.5" /> Share</button>
          </div>
        )}

        <div className="flex gap-2 border-t p-3">
          <button onClick={onExit} className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">Exit arena</button>
          <button onClick={onNew} className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-bold text-white', won ? 'bg-linear-to-r from-emerald-500 to-teal-600' : 'bg-linear-to-r from-rose-500 to-orange-600', 'hover:opacity-90')}>
            New challenge
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
