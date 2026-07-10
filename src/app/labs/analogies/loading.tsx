import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  )
}
