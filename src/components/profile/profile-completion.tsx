'use client'

// Optional nudge to fill in career info. Shows a completion ring + the remaining
// checklist items and opens the edit dialog. Hidden at 100%, and dismissible for
// the session. Never blocks anything — purely a prompt.
import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import type { ProfileInfo } from '@/lib/profile/shared'
import { completion } from '@/lib/profile/shared'
import { Button } from '@/components/ui/button'
import { EditProfileDialog } from './edit-profile-dialog'

export function ProfileCompletion({ info }: { info: ProfileInfo }) {
  const [dismissed, setDismissed] = useState(false)
  const c = completion(info)

  if (c.percent >= 100 || dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-fuchsia-500/20 bg-linear-to-br from-amber-50 via-white to-fuchsia-50 p-5 shadow-sm dark:from-amber-950/20 dark:via-card dark:to-fuchsia-950/20">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-muted-foreground/70 hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <CompletionRing percent={c.percent} />

        <div className="flex-1">
          <h3 className="flex items-center gap-1.5 text-base font-bold">
            <Sparkles className="size-4 text-fuchsia-500" />
            Complete your profile
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {c.filled} of {c.total} done. Add the rest to show off a full profile.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {c.missing.map((m) => (
              <span key={m.key} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {m.label}
              </span>
            ))}
          </div>
          <EditProfileDialog info={info}>
            <Button size="sm" className="mt-3.5">Complete now</Button>
          </EditProfileDialog>
        </div>
      </div>
    </div>
  )
}

function CompletionRing({ percent }: { percent: number }) {
  const size = 76
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - percent / 100)
  return (
    <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="stroke-fuchsia-500 transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
        {percent}%
      </div>
    </div>
  )
}
