'use client'

import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Trophy, Skull, Sparkles, Code2, Download, Link2, Share2, Check, Flame } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { playVictoryFanfare, playDefeatThud, playCoin } from '@/lib/visualizer/sound'
import { useArenaJuice, XpMotes } from './arena-fx'
import type { SubmitResult } from './challenge-setup'

interface Props {
  result: SubmitResult
  stake: number
  calm?: boolean
  sound?: boolean
  onNew: () => void
  onExit: () => void
}

// Fire dual side cannons (gold + rose) for a short burst.
function sideCannons() {
  const end = Date.now() + 1100
  const colors = ['#fbbf24', '#f43f5e', '#fb923c', '#fde68a']
  const frame = () => {
    if (Date.now() > end) return
    confetti({ particleCount: 3, angle: 60, spread: 60, startVelocity: 62, origin: { x: 0, y: 0.6 }, colors })
    confetti({ particleCount: 3, angle: 120, spread: 60, startVelocity: 62, origin: { x: 1, y: 0.6 }, colors })
    requestAnimationFrame(frame)
  }
  frame()
}

export function ChallengeResult({ result, stake, calm, sound, onNew, onExit }: Props) {
  const won = result.status === 'won'
  const juice = useArenaJuice(calm)
  const [showSolution, setShowSolution] = useState(false)
  const [copied, setCopied] = useState(false)
  // Staged victory: flash → card. Also drives the XP count-up.
  const [flash, setFlash] = useState(won && juice)
  const [xpShown, setXpShown] = useState(won && juice ? 0 : result.xpDelta)
  const [motesGo, setMotesGo] = useState(false)
  const xpRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (won) {
      if (sound) playVictoryFanfare()
      if (juice) {
        setTimeout(() => setFlash(false), 90)
        setTimeout(sideCannons, 180)
        // Clutch win — an extra centre burst for the drama.
        if (result.clutch) setTimeout(() => confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.5 }, colors: ['#f43f5e', '#fbbf24', '#fb923c'] }), 620)
        // XP roll-up with coin blips.
        const target = result.xpDelta
        const steps = Math.min(24, Math.max(8, Math.round(target / 8)))
        let i = 0
        const id = setInterval(() => {
          i++
          setXpShown(Math.round((target * i) / steps))
          if (sound && i % 3 === 0) playCoin()
          if (i >= steps) { setXpShown(target); setMotesGo(true); clearInterval(id) }
        }, 40)
        return () => clearInterval(id)
      } else {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } })
      }
    } else if (sound) {
      playDefeatThud()
    }
    // one-shot on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    a.href = imgUrl; a.download = 'js-motion-victory.png'; a.target = '_blank'; a.click()
  }
  const nativeShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'I won a Js Motion challenge!', url: shareUrl })
      else await copyLink()
    } catch { /* cancelled */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm',
        won ? 'bg-black/50' : 'bg-black/60 [filter:saturate(0.5)]',
      )}
    >
      {won && motesGo && <XpMotes originRef={xpRef} calm={calm} sound={sound} />}

      {/* Victory white flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 bg-white"
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={won && juice ? { scale: 0.7, y: 0, opacity: 0 } : { scale: 0.9, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={won && juice
          ? { type: 'spring', stiffness: 340, damping: 17, delay: 0.08 }
          : { type: 'spring', stiffness: 240, damping: 24, duration: 0.5 }}
        className={cn(
          'relative w-full max-w-sm overflow-hidden rounded-2xl border-2 bg-card text-center shadow-2xl',
          won ? 'border-emerald-400' : 'border-rose-500',
        )}
      >
        {/* CLUTCH stamp — a timed win with the clock nearly out. */}
        {won && result.clutch && (
          <motion.div
            initial={juice ? { scale: 2.4, rotate: -20, opacity: 0 } : false}
            animate={{ scale: 1, rotate: -12, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.4 }}
            className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border-2 border-amber-400 bg-amber-400/20 px-2 py-0.5 text-xs font-black uppercase tracking-widest text-amber-500 shadow-[0_0_14px_2px_rgba(251,191,36,0.5)]"
          >
            Clutch!
          </motion.div>
        )}
        <div className={cn('flex flex-col items-center gap-2 px-6 py-6', won ? 'bg-linear-to-b from-emerald-500/15 to-transparent' : 'bg-linear-to-b from-rose-500/15 to-transparent')}>
          <motion.div
            initial={won && juice ? { scale: 2.6, rotate: -12, opacity: 0 } : false}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.14 }}
            className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', won ? 'bg-linear-to-br from-emerald-400 to-teal-600' : 'bg-linear-to-br from-rose-500 to-red-700')}
          >
            {won ? <Trophy className="h-7 w-7 text-white" /> : <Skull className="h-7 w-7 text-white" />}
          </motion.div>
          <h2 className="text-xl font-black">{won ? 'Victory!' : result.reason === 'timeout' ? "Time's up!" : 'Challenge lost'}</h2>
          <p className="text-sm text-muted-foreground">{result.passed}/{result.total} hidden tests passed</p>
          <div ref={xpRef} className={cn('mt-1 font-mono text-3xl font-black tabular-nums', won ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {won ? `+${xpShown}` : `−${stake}`} XP
          </div>
          {won && result.winStreak && result.winStreak > 1 && (
            <motion.div
              initial={juice ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 16 }}
              className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400"
            >
              <Flame className="h-3 w-3" /> {result.winStreak}-win streak{result.multiplier && result.multiplier > 1 ? ` · ${result.multiplier}× bonus` : ''}
            </motion.div>
          )}
          <p className="text-[11px] text-muted-foreground">Balance: {result.balance} XP</p>
          {won && result.xpDelta > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><Sparkles className="h-3 w-3" /> stake returned + bonus</p>
          )}
        </div>

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

        {won && shareUrl && (
          <div className="flex items-center justify-center gap-2 border-t px-4 py-2.5">
            <button onClick={download} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted"><Download className="h-3.5 w-3.5" /> Card</button>
            <button onClick={copyLink} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Link'}</button>
            <button onClick={nativeShare} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted"><Share2 className="h-3.5 w-3.5" /> Share</button>
          </div>
        )}

        <div className="flex gap-2 border-t p-3">
          <button onClick={onExit} className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">Exit arena</button>
          <button onClick={onNew} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white', won ? 'bg-linear-to-r from-emerald-500 to-teal-600' : 'bg-linear-to-r from-rose-500 to-orange-600', 'hover:opacity-90')}>
            {!won && <Flame className="h-4 w-4" />}{won ? 'New challenge' : 'Rematch'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
