'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Columns2, Contrast, Layers, SlidersHorizontal } from 'lucide-react'

import { PixelFrame } from '@/components/pixel/preview-frame'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Canvas } from '@/lib/pixel/challenges'
import type { FrameSource } from '@/lib/pixel/harness'
import { cn } from '@/lib/utils'

export type CompareMode = 'side' | 'slide' | 'diff' | 'onion'

/**
 * How solid the learner's build is on its side of the wipe.
 *
 * Not 1. A hard wipe shows you the two halves but never the two *together*, so
 * anything misaligned reads as fine right up until the divider crosses it.
 * Letting the target ghost through means an edge that is 4px out shows as a
 * doubled edge wherever you happen to be looking, rather than only at the seam.
 *
 * High enough that the learner's work still reads as theirs — Onion mode is
 * where you go to dial this properly.
 */
const SLIDE_GHOST = 0.85

const MODES: Array<{ value: CompareMode; label: string; icon: typeof Columns2; hint: string }> = [
  { value: 'side', label: 'Side', icon: Columns2, hint: 'Target and your build, next to each other' },
  { value: 'slide', label: 'Slide', icon: SlidersHorizontal, hint: 'Wipe between the two — drag the divider' },
  { value: 'diff', label: 'Diff', icon: Contrast, hint: 'Black where you match. Anything glowing is wrong.' },
  { value: 'onion', label: 'Onion', icon: Layers, hint: 'Fade your build over the target' },
]

/**
 * A layer stack at the canvas's natural size, scaled as a whole.
 *
 * The scale is on the wrapper rather than on each layer, which helps but does
 * **not** make the blend exact — measured, not assumed. The theory was that
 * children composite at natural resolution inside this stacking context and the
 * finished result is then scaled; in practice Chrome gives the iframe its own
 * compositing layer and rasterises it at the *effective* scale, while the target
 * image is resampled by a different path. So at a fractional zoom a pixel-perfect
 * answer still shows faint ghosting on text.
 *
 * At 1:1 it is exact — verified: a correct answer diffs to pure black, matching
 * the server's 0-pixel verdict. Hence the zoom control, and the nudge toward it
 * in Diff mode. The number is the server's regardless; this is an aid for finding
 * *where* you are wrong, and at fit-scale it is honest about roughly where.
 *
 * `isolation: isolate` keeps mix-blend-mode from reaching the page behind it.
 */
function Stage({
  canvas,
  scale,
  className,
  children,
}: {
  canvas: Canvas
  scale: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('shrink-0 overflow-hidden rounded border bg-white shadow-sm', className)}
      style={{ width: canvas.width * scale, height: canvas.height * scale }}
    >
      <div
        className="relative"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          isolation: 'isolate',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-medium text-muted-foreground">{children}</p>
}

export function CompareStage({
  source,
  canvas,
  targetPng,
  className,
}: {
  source: FrameSource
  canvas: Canvas
  /** Absent for `brief` challenges — there is nothing to compare against, by design. */
  targetPng?: string
  className?: string
}) {
  const [mode, setMode] = useState<CompareMode>('side')
  const [fit, setFit] = useState(true)
  const [wipe, setWipe] = useState(50)
  const [onion, setOnion] = useState(50)

  const containerRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)

  // The panels are resizable, so the fit scale cannot be a constant.
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Side mode puts two canvases across the width, so each gets half the room.
  const sideBySide = canvas.width / canvas.height <= 2
  const budget = mode === 'side' && sideBySide ? (available - 12) / 2 : available
  const scale = fit && available > 0 ? Math.min(1, budget / canvas.width) : 1

  // `pointer-events-none` on both layers, and it is load-bearing for Slide:
  // an iframe eats the pointer, so a move over the learner's own build would
  // never reach the stage listening for it — the wipe would work over the
  // target half and freeze over theirs. Nothing here wants a click anyway. These
  // are pictures: the document has no scripts, and its links cannot navigate.
  const frame = useMemo(
    () => <PixelFrame source={source} canvas={canvas} className="pointer-events-none absolute inset-0" />,
    [source, canvas],
  )
  const target = targetPng ? (
    // eslint-disable-next-line @next/next/no-img-element -- a raw <img> is the point: it must be the exact bytes the scorer diffs against, unresampled and unoptimised.
    <img
      src={targetPng}
      alt=""
      width={canvas.width}
      height={canvas.height}
      className="pointer-events-none absolute inset-0 block"
    />
  ) : null

  // Follows the pointer, no button held. Wiping is a thing you do continuously
  // while reading the difference, and making it a drag puts a click between the
  // learner and every look. The toolbar slider stays in step for touch, for
  // keyboard, and for parking the divider somewhere while you edit.
  const onWipe = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setWipe(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)))
  }, [])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <ToggleGroup
          type="single"
          size="sm"
          value={targetPng ? mode : ''}
          onValueChange={(v) => v && setMode(v as CompareMode)}
          className="gap-0.5"
          disabled={!targetPng}
        >
          {MODES.map(({ value, label, icon: Icon, hint }) => (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                {/* The active mode has to be obvious: the default `data-[state=on]`
                    is a faint background tint, which at 11px on a toolbar reads
                    as nothing at all, and you cannot tell what you are looking at
                    without clicking each one to find out. */}
                <ToggleGroupItem
                  value={value}
                  aria-label={label}
                  className={cn(
                    'h-7 gap-1.5 px-2 text-[11px] font-medium text-muted-foreground transition-colors',
                    'data-[state=on]:bg-linear-to-r data-[state=on]:from-pink-500 data-[state=on]:to-violet-600',
                    'data-[state=on]:font-semibold data-[state=on]:text-white data-[state=on]:shadow-sm',
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden lg:inline">{label}</span>
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>

        {targetPng && (mode === 'slide' || mode === 'onion') && (
          <Slider
            value={[mode === 'slide' ? wipe : onion]}
            onValueChange={([v]) => (mode === 'slide' ? setWipe(v) : setOnion(v))}
            max={100}
            step={1}
            className="ml-1 w-24"
            aria-label={mode === 'slide' ? 'Wipe position' : 'Your build’s opacity'}
          />
        )}

        <button
          type="button"
          onClick={() => setFit((f) => !f)}
          className="ml-auto shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums hover:bg-accent hover:text-foreground"
        >
          {fit ? `${Math.round(scale * 100)}%` : '1:1'}
        </button>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
          {canvas.width}×{canvas.height}
        </span>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3">
        {!targetPng ? (
          // No target by design: the spec is the brief, and the brief lives on
          // the scroll at the bottom — one home for it, not two.
          <>
            <Label>Your build — read the brief below and hit every number.</Label>
            <Stage canvas={canvas} scale={scale}>
              {frame}
            </Stage>
          </>
        ) : mode === 'side' ? (
          <div className={cn('flex gap-3', sideBySide ? 'flex-row items-start' : 'flex-col')}>
            <div className="min-w-0">
              <Label>Target</Label>
              <Stage canvas={canvas} scale={scale}>
                {target}
              </Stage>
            </div>
            <div className="min-w-0">
              <Label>Yours</Label>
              <Stage canvas={canvas} scale={scale}>
                {frame}
              </Stage>
            </div>
          </div>
        ) : mode === 'diff' ? (
          <>
            <Label>
              Difference — black is a match. Anything you can see is a mistake.
              {scale < 1 && ' Text ghosts a little when zoomed out; switch to 1:1 for an exact diff.'}
            </Label>
            {/* Blending the live frame over the target, rather than diffing two
                images, means this updates as they type and costs no render. */}
            <Stage canvas={canvas} scale={scale}>
              {target}
              <div className="absolute inset-0" style={{ mixBlendMode: 'difference' }}>
                {frame}
              </div>
            </Stage>
          </>
        ) : mode === 'slide' ? (
          <>
            <Label>Move across to wipe between the target and your build.</Label>
            <div onPointerMove={onWipe} onPointerDown={onWipe} className="w-fit cursor-ew-resize touch-none">
              <Stage canvas={canvas} scale={scale}>
                {target}
                <div
                  className="absolute inset-0"
                  style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)`, opacity: SLIDE_GHOST }}
                >
                  {frame}
                </div>
                <div
                  className="absolute inset-y-0 w-px bg-pink-500 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
                  style={{ left: `${wipe}%` }}
                />
              </Stage>
            </div>
          </>
        ) : (
          <>
            <Label>Your build, faded over the target.</Label>
            <Stage canvas={canvas} scale={scale}>
              {target}
              <div className="absolute inset-0" style={{ opacity: onion / 100 }}>
                {frame}
              </div>
            </Stage>
          </>
        )}
      </div>
    </div>
  )
}
