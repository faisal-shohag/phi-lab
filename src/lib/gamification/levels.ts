// Leveling curve. Cumulative XP required to *reach* a level grows quadratically:
// level 1 = 0, level 2 = 100, level 3 = 300, level 4 = 600, level 5 = 1000 …
// (each level costs 100 XP more than the one before). Pure functions — safe to
// import on client or server.

export interface LevelInfo {
  /** Current level, starting at 1. */
  level: number
  /** Total XP the learner has. */
  xp: number
  /** Cumulative XP at the start of the current level. */
  levelFloor: number
  /** Cumulative XP needed to reach the next level. */
  nextLevelAt: number
  /** XP earned inside the current level. */
  xpIntoLevel: number
  /** XP span of the current level. */
  levelSpan: number
  /** Progress through the current level, 0–1. */
  progress: number
  /** Flavour title for the current level band. */
  title: string
}

const TITLES = [
  'Curious Beginner', // 1
  'Code Explorer', //    2
  'Loop Wrangler', //    3
  'Function Smith', //   4
  'Async Adept', //      5
  'Closure Sage', //     6
  'Stack Master', //     7
  'Algorithm Artisan', //8
  'Systems Thinker', //  9
  'Phi Grandmaster', //  10+
]

/** Cumulative XP required to reach `level` (level 1 → 0). */
export function cumulativeXpFor(level: number): number {
  if (level <= 1) return 0
  const n = level - 1
  return 50 * n * (n + 1) // 100, 300, 600, 1000, 1500 …
}

export function titleForLevel(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1] ?? TITLES[TITLES.length - 1]
}

export function levelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp))
  let level = 1
  while (cumulativeXpFor(level + 1) <= safeXp) level++

  const levelFloor = cumulativeXpFor(level)
  const nextLevelAt = cumulativeXpFor(level + 1)
  const levelSpan = nextLevelAt - levelFloor
  const xpIntoLevel = safeXp - levelFloor
  const progress = levelSpan > 0 ? xpIntoLevel / levelSpan : 1

  return {
    level,
    xp: safeXp,
    levelFloor,
    nextLevelAt,
    xpIntoLevel,
    levelSpan,
    progress,
    title: titleForLevel(level),
  }
}
