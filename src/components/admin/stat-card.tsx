import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  /** Muted when there's nothing to report, so zeros don't read as alarms. */
  tone?: 'default' | 'warning'
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        {Icon ? <Icon className="text-muted-foreground size-4" /> : null}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-semibold tabular-nums',
            tone === 'warning' && value !== '0' && 'text-destructive',
          )}
        >
          {value}
        </div>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
