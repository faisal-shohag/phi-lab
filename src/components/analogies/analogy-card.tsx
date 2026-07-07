'use client'

// The on-screen analogy card. Used both in the lab and on public share pages.
import { ArrowRight } from 'lucide-react'
import type { AnalogyCardData } from '@/lib/analogies/concepts'
import { cn } from '@/lib/utils'

export function AnalogyCard({ data, className }: { data: AnalogyCardData; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border-2 border-border bg-card shadow-lg',
        className,
      )}
    >
      {/* Header */}
      <div className="relative bg-linear-to-br from-amber-500 via-orange-500 to-rose-500 px-6 py-6 text-white">
        <div className="text-4xl leading-none">{data.emoji}</div>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight">{data.title}</h2>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-white/80">{data.concept}</p>
      </div>

      <div className="space-y-4 p-6">
        {/* Scene */}
        <p className="text-[15px] leading-relaxed text-foreground">{data.scene}</p>

        {/* Mapping */}
        {data.mapping.length > 0 && (
          <div className="space-y-1.5">
            {data.mapping.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-300">{m.concept}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{m.everyday}</span>
              </div>
            ))}
          </div>
        )}

        {/* So basically */}
        <div className="rounded-xl bg-linear-to-r from-amber-500/10 to-rose-500/10 px-4 py-3">
          <p className="text-sm font-semibold">
            <span className="text-amber-600 dark:text-amber-400">So basically —</span> {data.soBasically}
          </p>
        </div>

        {/* Tech note */}
        <div className="rounded-xl border border-dashed border-border px-4 py-3">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">The real thing</p>
          <p className="text-sm text-muted-foreground">{data.techNote}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-muted-foreground">🛺 Made with Phi Lab</span>
          <span className="text-xs text-muted-foreground">phi-lab</span>
        </div>
      </div>
    </div>
  )
}
