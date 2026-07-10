import { Skeleton } from '@/components/ui/skeleton'

// Covers the admin layout's own await (requireAdmin) plus the child page.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
