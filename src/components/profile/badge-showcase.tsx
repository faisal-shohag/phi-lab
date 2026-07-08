// Read-only badge grid for the public profile page. Mirrors the owner's live
// Achievements grid visually, but takes a static set of earned ids (no client XP
// store). Pure/server-safe.
import {
  Sparkles, Rocket, GraduationCap, Mic, Trophy, Flame, Target, Zap, Crown, Snowflake,
  Presentation, Lightbulb, Languages, MessageCircle, Palette, LifeBuoy, Lock,
  type LucideIcon,
} from 'lucide-react'
import { BADGES } from '@/lib/gamification/badges'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  Sparkles, Rocket, GraduationCap, Mic, Trophy, Flame, Target, Zap, Crown, Snowflake, Presentation, Lightbulb, Languages, MessageCircle, Palette, LifeBuoy,
}

export function BadgeShowcase({ badgeIds }: { badgeIds: string[] }) {
  const earned = new Set(badgeIds)
  const earnedCount = BADGES.filter((b) => earned.has(b.id)).length

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Badges</h2>
        <span className="text-sm text-muted-foreground">{earnedCount} / {BADGES.length} unlocked</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BADGES.map((b) => {
          const Icon = ICONS[b.icon] ?? Sparkles
          const got = earned.has(b.id)
          return (
            <div
              key={b.id}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-colors',
                got ? 'border-border bg-card shadow-sm' : 'border-dashed border-border/60 bg-muted/30',
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full',
                  got ? cn('bg-linear-to-br text-white shadow-md', b.tint) : 'bg-muted text-muted-foreground',
                )}
              >
                {got ? <Icon className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
              </div>
              <div className={cn('text-sm font-semibold', !got && 'text-muted-foreground')}>{b.label}</div>
              <div className="text-[11px] leading-snug text-muted-foreground">{b.description}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
