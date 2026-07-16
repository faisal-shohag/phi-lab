'use client'

// The board.
//
// This is the lab's home, not a progress readout tucked behind a button. It
// answers the three questions a flat sidebar of 27 titles could not: where am I,
// what is next, and what is all this for. js-motion's progress-map.tsx is the
// nearest relative and deliberately not reused — it is a <ul> with a CSS line
// down the side, which is the right answer for a curriculum and the wrong one
// for a run.
//
// Geometry lives in lib/pixel/map-layout.ts and unlock rules in lib/pixel/unlock.ts,
// both pure. This file is the paint.

import { useCallback, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Crown, Lock, Sparkles, Trophy } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PIXEL_TOPICS, TOTAL_CHALLENGES, type PixelChallenge, type TopicId } from '@/lib/pixel/challenges'
import { mapLayout, travelled, type MapNode } from '@/lib/pixel/map-layout'
import { TIER_XP, TIERS } from '@/lib/pixel/score'
import { isCleared, unlockStates, type NodeState, type TiersByChallenge } from '@/lib/pixel/unlock'
import { cn } from '@/lib/utils'

/** Everything a challenge can be worth: 6 + 10 + 15. From score.ts, never re-declared. */
const XP_PER_CHALLENGE = TIERS.reduce((sum, tier) => sum + TIER_XP[tier], 0)

const MAP_BACKDROP = '/pixel-lab/map-backdrop.webp'

/**
 * Text on terrain.
 *
 * A scrim alone is not enough for 10px labels sitting over trees and snowlines:
 * contrast changes under every letter. `paint-order: stroke` draws a dark
 * outline *behind* the glyph rather than over it, which is the one way to keep
 * small type legible on an image without boxing every label in a chip and
 * turning the board into a form.
 */
const ON_TERRAIN: React.CSSProperties = {
  paintOrder: 'stroke',
  stroke: 'rgba(2,6,23,0.85)',
  strokeWidth: 3,
  strokeLinejoin: 'round',
}

const TOPIC_TITLE: Record<TopicId, string> = Object.fromEntries(
  PIXEL_TOPICS.map((t) => [t.id, t.title]),
) as Record<TopicId, string>

function earnedXp(tiers: TiersByChallenge, id: string): number {
  return (tiers[id] ?? []).reduce((sum, tier) => sum + TIER_XP[tier], 0)
}

const NODE_R = 22

function Node({
  node,
  state,
  tiers,
  isNext,
  justOpened,
  onPick,
}: {
  node: MapNode
  state: NodeState
  tiers: TiersByChallenge
  isNext: boolean
  justOpened: boolean
  onPick: (c: PixelChallenge) => void
}) {
  const reduce = useReducedMotion()
  const locked = state === 'locked'
  const xp = earnedXp(tiers, node.id)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-label={`${node.challenge.title}${locked ? ' — locked' : ''}`}
          aria-disabled={locked}
          className={cn('outline-none', locked ? 'cursor-not-allowed' : 'cursor-pointer')}
          onClick={() => !locked && onPick(node.challenge)}
          onKeyDown={(e) => {
            if (locked) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onPick(node.challenge)
            }
          }}
        >
          {/* A node that just opened gets a burst — an extra ring thrown outward
              and discarded, on top of a node that was always drawn.

              It used to be an entrance: the <g> started at scale 0 and animated
              in. That hid the node and then never animated (opacity stuck at 0,
              transform stuck at matrix(0,0,0,0,0,0) — measured), so the one node
              the board was trying to celebrate was the only one you could not
              see. Whatever the cause, the shape was wrong: an announcement that
              hides its subject until an animation succeeds has nothing to fall
              back to. Additive can only fail to nothing. */}
          {justOpened && !reduce && (
            <motion.circle
              cx={node.x}
              cy={node.y}
              className="fill-none stroke-pink-400"
              strokeWidth={3}
              initial={{ r: NODE_R, opacity: 0.9 }}
              animate={{ r: NODE_R * 2.6, opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.35 }}
            />
          )}

          {/* "You are here". A ring outside the node so it reads at a glance
              without changing the node's own size. */}
          {isNext && !reduce && (
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={NODE_R + 5}
              className="fill-none stroke-pink-500"
              strokeWidth={2}
              initial={{ opacity: 0.9, scale: 1 }}
              animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.14, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
          )}
          {isNext && reduce && (
            <circle cx={node.x} cy={node.y} r={NODE_R + 5} className="fill-none stroke-pink-500" strokeWidth={2} />
          )}

          <circle
            cx={node.x}
            cy={node.y}
            r={NODE_R}
            className={cn(
              'transition-colors',
              state === 'perfect' && 'fill-amber-400 stroke-amber-200',
              state === 'cleared' && 'fill-emerald-500 stroke-emerald-200',
              state === 'available' && 'fill-slate-950 stroke-pink-500',
              locked && 'fill-slate-800/90 stroke-slate-500/60',
            )}
            strokeWidth={2}
          />

          <foreignObject x={node.x - NODE_R} y={node.y - NODE_R} width={NODE_R * 2} height={NODE_R * 2}>
            <div className="flex h-full w-full items-center justify-center">
              {locked ? (
                <Lock className="size-4 text-slate-400" />
              ) : state === 'perfect' ? (
                <Crown className="size-4 text-white" />
              ) : state === 'cleared' ? (
                <Trophy className="size-4 text-white" />
              ) : (
                <span className="font-mono text-[11px] font-bold text-pink-400 tabular-nums">
                  {node.index + 1}
                </span>
              )}
            </div>
          </foreignObject>

          {/* Fixed colours, not theme tokens. The board is its own surface over
              the terrain — `text-foreground` here would be white on sunlit grass
              in dark mode and near-black on dark water in light mode. */}
          <text
            x={node.x}
            y={node.y + NODE_R + 15}
            textAnchor="middle"
            style={ON_TERRAIN}
            className={cn(
              'pointer-events-none text-[10px] font-semibold',
              locked ? 'fill-slate-400' : 'fill-white',
            )}
          >
            {node.challenge.title.length > 15 ? `${node.challenge.title.slice(0, 14)}…` : node.challenge.title}
          </text>

          {/* The XP. Banked shows what they have; otherwise what is on offer —
              the reason to click. */}
          <text
            x={node.x}
            y={node.y + NODE_R + 27}
            textAnchor="middle"
            style={ON_TERRAIN}
            className={cn(
              'pointer-events-none font-mono text-[9px] tabular-nums',
              xp > 0 ? 'fill-emerald-300' : 'fill-slate-300/80',
            )}
          >
            {xp > 0 ? `${xp}/${XP_PER_CHALLENGE} XP` : `${XP_PER_CHALLENGE} XP`}
          </text>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 flex-col">
        <p className="font-semibold">{node.challenge.title}</p>
        <p className="mt-0.5 text-xs opacity-90">
          {locked ? 'Clear the challenge before this one to open it.' : node.challenge.brief}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

/** A topic gate: the milestone the run is actually for. */
function TopicGate({ node, cleared, total }: { node: MapNode; cleared: number; total: number }) {
  const done = cleared === total
  return (
    <g className="pointer-events-none">
      <foreignObject x={node.x - 74} y={node.y - NODE_R - 42} width={148} height={26}>
        <div
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm',
            done
              ? 'border-amber-400/70 bg-amber-400/25 text-amber-100'
              : 'border-white/20 bg-slate-950/70 text-slate-300',
          )}
        >
          {done && <Sparkles className="size-3" />}
          {TOPIC_TITLE[node.topicId]}
          <span className="font-mono tabular-nums opacity-70">
            {cleared}/{total}
          </span>
        </div>
      </foreignObject>
    </g>
  )
}

export interface ChallengeMapProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  tiers: TiersByChallenge
  currentId: string
  nextId: string | null
  /** Challenges that opened on the last score — these arrive rather than appear. */
  justOpened: string[]
  signedIn: boolean
  onPick: (c: PixelChallenge) => void
}

export function ChallengeMap({
  open,
  onOpenChange,
  tiers,
  currentId,
  nextId,
  justOpened,
  signedIn,
  onPick,
}: ChallengeMapProps) {
  const reduce = useReducedMotion()
  const layout = useMemo(() => mapLayout(), [])
  const states = useMemo(() => unlockStates(tiers), [tiers])

  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  /**
   * The pointer is a lens: where it sits in the viewport is which part of the
   * board you are looking at.
   *
   * Proportional rather than edge-scrolling or drag. Edge-scrolling makes you
   * hold still at a boundary and wait, and drag makes you clamp a button to read
   * a map — both are jobs. This is one gesture with no click in it: pointer to
   * the bottom, you are at the bottom.
   *
   * The overflow is measured live rather than derived from the layout, because
   * the board is `w-full` and its rendered height depends on the dialog's width.
   * `Math.max(0, …)` matters: on an axis that already fits there is no overflow
   * to pan, and without the clamp the board would drift on an axis with nothing
   * to show.
   */
  const onPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const board = boardRef.current
    if (!viewport || !board) return

    const box = viewport.getBoundingClientRect()
    const overflowX = Math.max(0, board.offsetWidth - box.width)
    const overflowY = Math.max(0, board.offsetHeight - box.height)
    if (overflowX === 0 && overflowY === 0) return

    // 0…1 across the viewport, clamped so a pointer leaving at speed cannot
    // overshoot the last frame.
    const fx = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    const fy = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))

    // Negative: moving the pointer down pulls the board up, revealing what is
    // below. The inverse would feel like pushing a page away from you.
    setPan({ x: -fx * overflowX, y: -fy * overflowY })
  }, [])

  const clearedCount = layout.nodes.filter((n) => isCleared(tiers, n.id)).length
  const perfectCount = layout.nodes.filter((n) => states[n.id] === 'perfect').length
  // Where the learner is standing, which is what the road draws to — not how
  // many they have cleared. See travelled() in map-layout.ts.
  const position = Math.max(0, layout.nodes.findIndex((n) => n.id === (nextId ?? currentId)))
  const xpEarned = layout.nodes.reduce((sum, n) => sum + earnedXp(tiers, n.id), 0)
  const xpTotal = TOTAL_CHALLENGES * XP_PER_CHALLENGE

  const clearedPerTopic = useMemo(() => {
    const out: Record<string, { cleared: number; total: number }> = {}
    for (const topic of PIXEL_TOPICS) {
      out[topic.id] = {
        cleared: topic.challenges.filter((c) => isCleared(tiers, c.id)).length,
        total: topic.challenges.length,
      }
    }
    return out
  }, [tiers])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Two load-bearing overrides here, both about DialogContent's own defaults.
          `sm:max-w-4xl` must carry the same `sm:` key as its default
          (`sm:max-w-sm`) or tailwind-merge keeps both and the narrower one wins
          above 640px — the board would render at 384px. Same trap documented in
          visualizer/progress-map.tsx and leaderboard-sheet.tsx.

          `flex flex-col` matters just as much and is less obvious: DialogContent
          is a **grid**. A `flex-1 min-h-0` child of a grid is meaningless, so the
          body took its natural height, blew past max-h, and got clipped — the run
          simply ended at Cards with no way to reach the rest. Switching the
          display to flex is what gives the body something to be 1 of, and lets it
          scroll. */}
      <DialogContent
        showCloseButton
        // Radix parks focus back on whatever opened the dialog when it closes.
        // Here that fights the editor, which wants the caret the moment the board
        // gets out of the way — and Radix wins, because it restores after the
        // close. Ceding it lets the arena take focus itself.
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="shrink-0 border-b bg-linear-to-r from-pink-500/10 via-fuchsia-500/10 to-violet-500/10 p-4">
          <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-pink-500 via-fuchsia-500 to-violet-600 shadow">
              <Trophy className="size-4 text-white" />
            </span>
            The Run
            <span className="ml-auto flex items-center gap-3 text-[11px] font-bold normal-case tracking-normal">
              <span className="font-mono tabular-nums text-muted-foreground">
                {clearedCount}/{TOTAL_CHALLENGES} cleared
              </span>
              <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {perfectCount} perfect
              </span>
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {xpEarned}/{xpTotal} XP
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Panning, not scrolling ──
            `overflow: hidden`, and the board is moved with a transform instead.
            A scrollbar down the side of a game map is a spreadsheet tell, and
            hiding one while keeping the scrolling means fighting the browser's
            own gesture handling for the rest of time. Owning the offset outright
            is less code and gives the pointer-follow below something to write to.

            `min-h-0` is what lets this size at all: a flex child's default
            min-height is auto — "never shrink below my content" — which silently
            defeats any overflow rule you put on it. */}
        <div
          ref={viewportRef}
          onPointerMove={onPan}
          onPointerLeave={() => setPan({ x: 0, y: 0 })}
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden"
        >
          {!signedIn && (
            // The gate is re-derived here rather than trusted from the endpoint,
            // which 401s for guests — a signed-out visitor must be told why the
            // board is shut, not shown a board that lies about it.
            <p className="absolute inset-x-4 top-4 z-10 rounded-lg border border-pink-500/40 bg-pink-500/15 px-3 py-2 text-xs backdrop-blur-sm">
              Sign in to bank XP and open the run. You can still play the first challenge.
            </p>
          )}

          {/* The terrain. On the wrapper rather than the viewport so it travels
              with the board — a fixed backdrop under a moving map reads as the
              map sliding over a photo.

              The scrim is not decoration. The art is bright green and blue; the
              node labels are theme-coloured, so on the raw image they are white
              text on sunlit grass in dark mode and dark text on dark water in
              light mode — unreadable both ways. A dark wash under everything
              makes the board one surface with one contrast story, the way the
              flame leaderboard commits to its own palette rather than inheriting
              the page's. */}
          <motion.div
            ref={boardRef}
            className="relative w-full"
            style={{
              backgroundImage: `url(${MAP_BACKDROP})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            animate={{ x: pan.x, y: pan.y }}
            // Damped follow, not a leash. The pointer sets a target and the board
            // eases toward it, so a twitch does not fling the map.
            //
            // Tuned up from stiffness 90: at that rate the board was still
            // travelling a second after the pointer stopped, which reads as lag
            // rather than weight. Snappy enough to feel attached, damped enough
            // that nodes do not skate out from under the cursor — and note they
            // do still drift toward you at about half pointer speed, which is
            // what makes a node reachable while the board is moving.
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 30, mass: 0.5 }}
          >
            <div aria-hidden className="absolute inset-0 bg-linear-to-b from-slate-950/75 via-slate-950/60 to-slate-950/80" />
            {/* Terrain spans the dialog; the run itself stays narrower and centred,
                so the board has edges to breathe against rather than nodes pinned
                to the frame. */}
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="relative mx-auto h-auto w-full max-w-3xl"
              style={{ minHeight: 320 }}
              role="img"
              aria-label={`Pixel Lab run: ${clearedCount} of ${TOTAL_CHALLENGES} challenges cleared`}
            >
            {/* The road not yet walked. Fixed colour, not `stroke-border` — that
                token is near-invisible against the terrain in either theme. */}
            <path
              d={layout.d}
              className="fill-none stroke-white/45"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="1 10"
            />
            {/* The road behind you. pathLength normalises the path to 0…1, so this
                is the first SVG path animation in the repo and needs no manual
                strokeDasharray arithmetic.

                `initial` is where the road *was*, not zero — and that matters more
                than it looks. The board is a dialog: it unmounts on close, so this
                path mounts fresh every time it opens. Starting at zero would mean
                re-drawing the whole run from scratch on every single open, and
                worse, the resting state would be "no road at all" — so if the
                animation never runs the learner sees a blank route. That is not
                hypothetical: framer-motion rides requestAnimationFrame, and Chrome
                fires no rAF for a tab it is not painting. Score, switch tab, come
                back, and the road would be gone.

                So: open with the road already correct, and animate only the bit
                that was just earned. The draw happens exactly when it means
                something — an unlock — and a frozen frame leaves the road right
                rather than empty. */}
            <motion.path
              d={layout.d}
              className="fill-none stroke-pink-500"
              strokeWidth={6}
              strokeLinecap="round"
              initial={
                reduce || justOpened.length === 0
                  ? false
                  : { pathLength: travelled(Math.max(0, position - justOpened.length), layout.nodes.length) }
              }
              animate={{ pathLength: travelled(position, layout.nodes.length) }}
              transition={reduce ? { duration: 0 } : { duration: 0.9, ease: 'easeInOut' }}
            />

            {layout.nodes.map((node) =>
              node.topicStart ? (
                <TopicGate
                  key={`gate-${node.id}`}
                  node={node}
                  cleared={clearedPerTopic[node.topicId].cleared}
                  total={clearedPerTopic[node.topicId].total}
                />
              ) : null,
            )}

            {/* No AnimatePresence: nodes never leave the board, so there is no
                exit to wait for. */}
            {layout.nodes.map((node) => (
                <Node
                  key={node.id}
                  node={node}
                  state={states[node.id]}
                  tiers={tiers}
                  isNext={node.id === (nextId ?? currentId)}
                  justOpened={justOpened.includes(node.id)}
                  onPick={onPick}
                />
              ))}
            </svg>
          </motion.div>

          {/* Says what the room does. Without it the board just seems to drift. */}
          <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-950/70 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/60 backdrop-blur-sm">
            move the pointer to look around
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
