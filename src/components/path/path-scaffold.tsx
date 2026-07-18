// The instant shell for /path. Drawn entirely from MODULES (pure static data),
// so it needs no per-user snapshot and paints the moment the route mounts. It
// mirrors the real map's layout — module rails, node rows, header block — so when
// the streamed progress overlay swaps in, nothing jumps. Shown as the <Suspense>
// fallback while getPathSnapshot runs.

import type { PathModule } from '@/lib/path/curriculum'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function PathScaffold({ modules }: { modules: PathModule[] }) {
  return (
    <div className="space-y-6">
      {/* header block */}
      <div className="rounded-2xl border bg-linear-to-br from-amber-500/10 via-background to-orange-500/5 p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-6 w-56" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2 flex-1 rounded-full" />
        </div>
      </div>

      {/* quest + weekly */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>

      {/* the actual module/node structure — real titles, no progress yet */}
      <div className="space-y-8">
        {modules.map((m) => (
          <section key={m.id}>
            <div className="mb-3 flex items-center gap-3">
              <div className={cn('h-8 w-1.5 rounded-full bg-linear-to-b opacity-60', m.tint)} />
              <div className="flex-1">
                <h3 className="text-sm font-black text-muted-foreground">{m.title}</h3>
                <p className="text-xs text-muted-foreground/70">{m.subtitle}</p>
              </div>
            </div>
            <div className="ml-[7px] space-y-2 border-l-2 border-dashed pl-4">
              {m.nodes.map((n) => (
                <div key={n.id} className="flex items-center gap-3 rounded-xl border bg-card/50 p-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-muted-foreground">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground/60">{n.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
