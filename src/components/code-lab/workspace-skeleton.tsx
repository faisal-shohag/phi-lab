import { Skeleton } from '@/components/ui/skeleton'

// Mirrors the <Workspace> frame (toolbar + left description / right editor + test
// panels) so the loading state occupies the same shape the real content lands in.
// Rendered by the [slug] and contest-solve loading.tsx boundaries — this is the
// instant paint the App Router shows while the problem is fetched on the server.
export function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* Top toolbar */}
      <header className="flex items-center gap-2 border-b bg-background px-3 py-1.5">
        <Skeleton className="h-8 w-24" />
        <div className="mx-auto flex items-center gap-1.5">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-1.5 p-1.5">
        {/* Left: description */}
        <div className="hidden w-[42%] flex-col gap-4 rounded-xl border bg-background p-5 sm:flex">
          <div className="flex items-center gap-2 border-b pb-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-7 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* Right: editor + test panel */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex-[62] rounded-xl border bg-background p-4">
            <div className="mb-4 flex items-center gap-2 border-b pb-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-7 w-32" />
            </div>
            <div className="space-y-2.5">
              {['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-3/5', 'w-1/2'].map((w, i) => (
                <Skeleton key={i} className={`h-4 ${w}`} />
              ))}
            </div>
          </div>
          <div className="flex-[38] rounded-xl border bg-background p-4">
            <Skeleton className="mb-3 h-5 w-24" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  )
}
