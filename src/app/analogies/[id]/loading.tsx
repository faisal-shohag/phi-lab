import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 via-white to-rose-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <Skeleton className="h-80 rounded-2xl" />
      </main>
    </div>
  )
}
