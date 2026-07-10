import Link from 'next/link'
import { cn } from '@/lib/utils'

interface RangePickerProps {
  basePath: string
  current: number
  options: number[]
}

/**
 * Time-range filter as plain links, so the selected range lives in the URL and
 * the page stays a Server Component. Bookmarkable and shareable, which a local
 * useState toggle would not be.
 */
export function RangePicker({ basePath, current, options }: RangePickerProps) {
  return (
    <div className="bg-muted inline-flex items-center rounded-lg p-1" role="group" aria-label="Time range">
      {options.map((days) => {
        const active = days === current
        return (
          <Link
            key={days}
            href={`${basePath}?days=${days}`}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {days}d
          </Link>
        )
      })}
    </div>
  )
}
