'use client'

// Three switches about furniture.
//
// Not js-motion's SettingsPanel: that is a 20-key feature-flag system with a
// group taxonomy, for a debugger where each flag changes what the lab *teaches*.
// Nothing here changes the work — only whether the board greets you, whether the
// corner map is there, and whether the thing makes a noise. A popover is the
// whole surface it needs.

import { useSyncExternalStore } from 'react'
import { Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import {
  SETTING_LABEL,
  getServerSettings,
  getSettings,
  setSetting,
  subscribeSettings,
  type PixelSettings,
} from '@/lib/pixel/settings'

export function usePixelSettings(): PixelSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getServerSettings)
}

const KEYS: Array<keyof PixelSettings> = ['mapOnLand', 'miniMap', 'sound']

export function SettingsMenu() {
  const settings = usePixelSettings()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" title="Lab settings" aria-label="Lab settings">
          <Settings2 className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Lab settings
        </p>
        <div className="space-y-0.5">
          {KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-tight">{SETTING_LABEL[key].title}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {SETTING_LABEL[key].hint}
                </p>
              </div>
              <Switch
                size="sm"
                className="mt-0.5 shrink-0"
                checked={settings[key]}
                onCheckedChange={(v) => setSetting(key, v)}
                aria-label={SETTING_LABEL[key].title}
              />
            </label>
          ))}
        </div>
        <p className="px-2 pb-1 pt-2 text-[10px] text-muted-foreground">
          Saved in this browser. Everything defaults to how the lab already behaved.
        </p>
      </PopoverContent>
    </Popover>
  )
}
