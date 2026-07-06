'use client'

import { Settings2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  FEATURE_META,
  type FeatureKey,
  type VisualizerSettings,
} from '@/lib/visualizer/settings'

interface SettingsPanelProps {
  settings: VisualizerSettings
  onToggle: (key: FeatureKey, value: boolean) => void
  onReset: () => void
  enabledCount: number
}

const GROUPS: ('Understanding' | 'Concepts')[] = ['Understanding', 'Concepts']

export function SettingsPanel({ settings, onToggle, onReset, enabledCount }: SettingsPanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Learning features" className="relative">
          <Settings2 className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Features</span>
          {enabledCount > 0 && (
            <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] tabular-nums" variant="secondary">
              {enabledCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/50">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Learning features</span>
          {enabledCount > 0 && (
            <button
              onClick={onReset}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              reset
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </div>
              <div className="space-y-1">
                {FEATURE_META.filter((f) => f.group === group).map((f) => {
                  const on = settings[f.key]
                  return (
                    <label
                      key={f.key}
                      className={cn(
                        'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors',
                        on ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40' : 'border-transparent hover:bg-accent',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{f.label}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{f.blurb}</div>
                      </div>
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => onToggle(f.key, v)}
                        size="sm"
                        className="mt-0.5 shrink-0"
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="px-1.5 text-[10px] text-muted-foreground leading-relaxed">
            Off by default. Your choices are saved on this device.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
