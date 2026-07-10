import { Skeleton } from '@/components/ui/skeleton'

// Covers the Hive layout's own await (getHiveUser) plus the feed page.
export default function Loading() {
  return (
    <div data-theme="hive" className="hive-shell min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
