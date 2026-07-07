'use client'

// Gamified XP pill for the nav: a gradient capsule with a level chip, live XP
// count, a slim progress bar toward the next level, and a shimmer sweep. Links
// to the achievements page. Renders nothing until a signed-in learner's profile
// has loaded.
import { useEffect } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useXp, refreshXp } from '@/lib/gamification/use-xp'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function XpBadge() {
  const { data: session, isPending } = authClient.useSession()
  const { xp, info, loaded } = useXp()

  const userId = session?.user?.id
  useEffect(() => {
    if (userId) void refreshXp()
  }, [userId])

  if (isPending || !session?.user || !loaded) return null

  const pct = Math.round(info.progress * 100)
  const toNext = Math.max(0, info.nextLevelAt - xp)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/profile"
          aria-label={`Level ${info.level}, ${xp} XP`}
          className="xp-shimmer group relative flex items-center gap-1.5 overflow-hidden rounded-full border border-amber-300/50 bg-linear-to-r from-amber-400/15 via-fuchsia-400/15 to-violet-500/15 py-1 pl-1 pr-2.5 outline-none transition-shadow hover:shadow-md hover:shadow-fuchsia-500/20 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-amber-400/25"
        >
          {/* Level chip */}
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 text-[11px] font-bold text-white shadow-sm">
            {info.level}
          </span>

          {/* XP count + progress bar */}
          <span className="relative flex flex-col leading-none">
            <span className="flex items-center gap-0.5 text-xs font-bold tabular-nums">
              <Sparkles className="h-3 w-3 text-amber-500" />
              {xp.toLocaleString()}
              <span className="ml-0.5 hidden text-[10px] font-semibold text-muted-foreground sm:inline">XP</span>
            </span>
            <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
              <span
                className="block h-full rounded-full bg-linear-to-r from-amber-400 to-fuchsia-500 transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          <div className="font-semibold">
            Level {info.level} · {info.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {xp.toLocaleString()} XP · {toNext.toLocaleString()} to level {info.level + 1}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
