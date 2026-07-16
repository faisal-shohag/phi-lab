// Where the nodes sit on the board, and the path that joins them.
//
// Pure geometry — no React, no DOM. It takes the catalog and returns points and
// an SVG `d` string, which is the whole reason it can be tested without a
// browser.
//
// ── Computed, not drawn ──
// Hand-authored coordinates were the obvious alternative and are a trap: 27
// nodes today, and every challenge anyone adds later would mean re-drawing the
// board by hand — or, more likely, not re-drawing it and shipping a node sitting
// on top of another. The serpentine is a function of the index, so the board
// stays correct for a catalog nobody has written yet.

import { ALL_CHALLENGES, type PixelChallenge, type TopicId } from './challenges'
import { isMilestone } from './unlock'

/** Nodes per row before the path turns back. */
const PER_ROW = 4
const COL_GAP = 150
const ROW_GAP = 130
const MARGIN_X = 90
const MARGIN_Y = 80

export interface MapNode {
  id: string
  challenge: PixelChallenge
  topicId: TopicId
  x: number
  y: number
  index: number
  /** Last of its topic — clearing it opens the next topic. */
  milestone: boolean
  /** First of its topic — where a gate label hangs. */
  topicStart: boolean
}

export interface MapLayout {
  nodes: MapNode[]
  /** The full route, as an SVG path `d`. */
  d: string
  width: number
  height: number
}

/**
 * A serpentine: left to right, drop a row, right to left.
 *
 * Boustrophedon, the way a game board reads — it keeps the whole run on one
 * screen without the path ever crossing itself, which a free-form layout cannot
 * promise.
 */
function position(index: number): { x: number; y: number } {
  const row = Math.floor(index / PER_ROW)
  const withinRow = index % PER_ROW
  // Odd rows run backwards, so the end of one row is directly above the start of
  // the next and the turn is a short hop rather than a long diagonal.
  const col = row % 2 === 0 ? withinRow : PER_ROW - 1 - withinRow
  return { x: MARGIN_X + col * COL_GAP, y: MARGIN_Y + row * ROW_GAP }
}

/**
 * A Catmull-Rom spline through the points, emitted as cubic béziers.
 *
 * Straight lines between nodes read as a flowchart. A curve reads as a road, and
 * this is the cheapest honest curve: it passes exactly *through* every node
 * (unlike a plain bézier, whose control points pull it off them), so the path
 * cannot drift away from the thing it is connecting.
 *
 * `tension` 0 is the standard uniform Catmull-Rom; smaller is tighter.
 */
function spline(points: Array<{ x: number; y: number }>, tension = 0.5): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    // Duplicate the ends so the first and last segments curve like the rest.
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? points[i + 1]

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2

    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`
  }
  return d
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function mapLayout(challenges: PixelChallenge[] = ALL_CHALLENGES): MapLayout {
  const nodes: MapNode[] = challenges.map((challenge, index) => {
    const { x, y } = position(index)
    return {
      id: challenge.id,
      challenge,
      topicId: challenge.topicId,
      x,
      y,
      index,
      milestone: isMilestone(challenge.id),
      topicStart: index === 0 || challenges[index - 1].topicId !== challenge.topicId,
    }
  })

  const rows = Math.ceil(challenges.length / PER_ROW)
  return {
    nodes,
    d: spline(nodes.map((n) => ({ x: n.x, y: n.y }))),
    width: MARGIN_X * 2 + (PER_ROW - 1) * COL_GAP,
    height: MARGIN_Y * 2 + Math.max(0, rows - 1) * ROW_GAP,
  }
}

/**
 * How far along the road the learner is standing, 0…1.
 *
 * Feeds framer-motion's `pathLength`. Counts node positions rather than
 * measuring the spline: the segments are near enough equal that arc-length would
 * cost real work to say the same thing.
 *
 * Takes a **position**, not a tally of cleared challenges, and the difference is
 * not academic. The road is sequential; "6 cleared" says nothing about where on
 * it you are if those six are scattered — which is exactly what a ledger from
 * before the gate existed looks like. Drawing to the position is monotonic, and
 * it is the question the road is actually asking: how much of this is behind me.
 */
export function travelled(positionIndex: number, total: number): number {
  if (total <= 1) return positionIndex > 0 ? 1 : 0
  return Math.min(1, Math.max(0, positionIndex / (total - 1)))
}
