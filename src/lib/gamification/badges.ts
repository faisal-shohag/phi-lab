// Badge catalog + evaluation. Definitions live here (not the DB) so shipping a
// new badge is a code change, not a migration/seed. Each badge's `earned`
// predicate runs against a small stats snapshot aggregated from XpEvents.

export interface BadgeStats {
  totalXp: number
  level: number
  interviewsCompleted: number
  bestInterviewScore: number
  quizCorrect: number
  bestQuizStreak: number
  /** Cleared a stern or stress-panel interview with a solid score. */
  hardModeCleared: boolean
  feynmanCompleted: number
  bestClarity: number
  englishCompleted: number
  bestEnglish: number
  analogiesCreated: number
  supportCompleted: number
}

export interface BadgeDef {
  id: string
  label: string
  description: string
  /** lucide-react icon name, resolved in the UI. */
  icon: string
  /** Tailwind gradient classes for the badge medallion. */
  tint: string
  earned: (s: BadgeStats) => boolean
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first-steps',
    label: 'First Steps',
    description: 'Earn your very first XP.',
    icon: 'Sparkles',
    tint: 'from-amber-400 to-orange-500',
    earned: (s) => s.totalXp >= 1,
  },
  {
    id: 'quick-study',
    label: 'Quick Study',
    description: 'Reach level 3.',
    icon: 'Rocket',
    tint: 'from-sky-400 to-blue-600',
    earned: (s) => s.level >= 3,
  },
  {
    id: 'scholar',
    label: 'Scholar',
    description: 'Reach level 5.',
    icon: 'GraduationCap',
    tint: 'from-violet-400 to-fuchsia-600',
    earned: (s) => s.level >= 5,
  },
  {
    id: 'interview-rookie',
    label: 'Interview Rookie',
    description: 'Finish your first mock interview.',
    icon: 'Mic',
    tint: 'from-emerald-400 to-teal-600',
    earned: (s) => s.interviewsCompleted >= 1,
  },
  {
    id: 'interview-pro',
    label: 'Interview Pro',
    description: 'Score 80+ in a mock interview.',
    icon: 'Trophy',
    tint: 'from-yellow-400 to-amber-600',
    earned: (s) => s.bestInterviewScore >= 80,
  },
  {
    id: 'interview-marathon',
    label: 'Marathoner',
    description: 'Complete 10 mock interviews.',
    icon: 'Flame',
    tint: 'from-rose-400 to-red-600',
    earned: (s) => s.interviewsCompleted >= 10,
  },
  {
    id: 'quiz-sharp',
    label: 'Sharp Eye',
    description: 'Answer 10 predict-the-output quizzes correctly.',
    icon: 'Target',
    tint: 'from-lime-400 to-green-600',
    earned: (s) => s.quizCorrect >= 10,
  },
  {
    id: 'quiz-streak-5',
    label: 'On Fire',
    description: 'Hit a 5-answer quiz streak.',
    icon: 'Zap',
    tint: 'from-orange-400 to-red-500',
    earned: (s) => s.bestQuizStreak >= 5,
  },
  {
    id: 'quiz-streak-10',
    label: 'Unstoppable',
    description: 'Hit a 10-answer quiz streak.',
    icon: 'Crown',
    tint: 'from-fuchsia-400 to-purple-600',
    earned: (s) => s.bestQuizStreak >= 10,
  },
  {
    id: 'ice-veins',
    label: 'Ice Veins',
    description: 'Score 60+ in a Stern or Stress Panel interview.',
    icon: 'Snowflake',
    tint: 'from-cyan-400 to-blue-600',
    earned: (s) => s.hardModeCleared,
  },
  {
    id: 'teacher-rookie',
    label: 'Teacher',
    description: 'Finish your first Feynman teach-back.',
    icon: 'Presentation',
    tint: 'from-indigo-400 to-blue-600',
    earned: (s) => s.feynmanCompleted >= 1,
  },
  {
    id: 'great-explainer',
    label: 'Great Explainer',
    description: 'Reach a clarity score of 80+ teaching a concept.',
    icon: 'Lightbulb',
    tint: 'from-amber-400 to-yellow-500',
    earned: (s) => s.bestClarity >= 80,
  },
  {
    id: 'speaks-up',
    label: 'Speaks Up',
    description: 'Finish your first English practice session.',
    icon: 'Languages',
    tint: 'from-sky-400 to-cyan-600',
    earned: (s) => s.englishCompleted >= 1,
  },
  {
    id: 'fluent-dev',
    label: 'Fluent Dev',
    description: 'Score 80+ for your spoken English.',
    icon: 'MessageCircle',
    tint: 'from-teal-400 to-emerald-600',
    earned: (s) => s.bestEnglish >= 80,
  },
  {
    id: 'analogy-artist',
    label: 'Analogy Artist',
    description: 'Create 5 rickshaw analogy cards.',
    icon: 'Palette',
    tint: 'from-orange-400 to-rose-500',
    earned: (s) => s.analogiesCreated >= 5,
  },
  {
    id: 'reached-out',
    label: 'Reached Out',
    description: 'Finish your first live support session.',
    icon: 'LifeBuoy',
    tint: 'from-rose-400 to-pink-600',
    earned: (s) => s.supportCompleted >= 1,
  },
]

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id)
}

/** All badge ids the stats currently satisfy. */
export function earnedBadgeIds(stats: BadgeStats): string[] {
  return BADGES.filter((b) => b.earned(stats)).map((b) => b.id)
}
