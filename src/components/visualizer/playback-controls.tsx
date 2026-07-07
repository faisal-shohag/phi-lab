'use client'

import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronFirst,
  ChevronLast,
  RotateCcw,
  FastForward,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface PlaybackControlsProps {
  isPlaying: boolean
  onPlayPause: () => void
  onStepBack: () => void
  onStepForward: () => void
  onFirst: () => void
  onLast: () => void
  onReset: () => void
  onSeek: (index: number) => void
  currentIndex: number
  totalSteps: number
  speed: number
  onSpeedChange: (speed: number) => void
  // Number of active breakpoints; when > 0 a "run to breakpoint" button shows.
  breakpointCount?: number
  onContinue?: () => void
}

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
]

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  onStepBack,
  onStepForward,
  onFirst,
  onLast,
  onReset,
  onSeek,
  currentIndex,
  totalSteps,
  speed,
  onSpeedChange,
  breakpointCount = 0,
  onContinue,
}: PlaybackControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card border rounded-lg shadow-sm">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onFirst} disabled={currentIndex === 0} title="First step">
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onStepBack} disabled={currentIndex === 0} title="Previous step">
          <SkipBack className="h-4 w-4" />
        </Button>
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
          <Button
            variant="default"
            size="icon"
            onClick={onPlayPause}
            disabled={totalSteps === 0}
            className="h-10 w-10 rounded-full bg-linear-to-r from-pink-500 to-red-500"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <motion.span
              key={isPlaying ? 'pause' : 'play'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="flex items-center justify-center"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </motion.span>
          </Button>
        </motion.div>
        <Button variant="ghost" size="icon" onClick={onStepForward} disabled={currentIndex >= totalSteps - 1} title="Next step">
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onLast} disabled={currentIndex >= totalSteps - 1} title="Last step">
          <ChevronLast className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onReset} title="Reset to start">
          <RotateCcw className="h-4 w-4" />
        </Button>
        {breakpointCount > 0 && onContinue && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onContinue}
            disabled={currentIndex >= totalSteps - 1}
            title={`Run to next breakpoint (${breakpointCount} set)`}
            className="text-rose-500 hover:text-rose-600"
          >
            <FastForward className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-w-45 flex items-center gap-3">
        <span className="text-sm font-mono tabular-nums text-muted-foreground whitespace-nowrap">
          {totalSteps === 0 ? '—' : `${currentIndex + 1} / ${totalSteps}`}
        </span>
        <Slider
          value={[currentIndex]}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          onValueChange={(v) => onSeek(Array.isArray(v) ? v[0] : v)}
        />
      </div>

      <div className="flex items-center gap-1">
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSpeedChange(opt.value)}
            className={cn(
              'px-2 py-1 text-xs font-mono rounded-md transition-all duration-150',
              speed === opt.value
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
