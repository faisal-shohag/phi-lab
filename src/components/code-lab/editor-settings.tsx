'use client'

import { useSyncExternalStore } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CODING_FONTS,
  getEditorSettings,
  getServerEditorSettings,
  setEditorSetting,
  subscribeEditorSettings,
} from '@/lib/code-lab/settings'

const TAB_SIZES = [2, 4, 8]

export function EditorSettingsMenu() {
  const s = useSyncExternalStore(subscribeEditorSettings, getEditorSettings, getServerEditorSettings)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Editor settings" aria-label="Editor settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Font family</Label>
          <Select value={s.fontFamily} onValueChange={(v) => setEditorSetting('fontFamily', v)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODING_FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Font size</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{s.fontSize}px</span>
          </div>
          <Slider
            min={11}
            max={24}
            step={1}
            value={[s.fontSize]}
            onValueChange={([v]) => setEditorSetting('fontSize', v)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Tab size</Label>
          <Select value={String(s.tabSize)} onValueChange={(v) => setEditorSetting('tabSize', Number(v))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAB_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} spaces
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Toggle label="Font ligatures" checked={s.fontLigatures} onChange={(v) => setEditorSetting('fontLigatures', v)} />
        <Toggle label="Minimap" checked={s.minimap} onChange={(v) => setEditorSetting('minimap', v)} />
        <Toggle label="Word wrap" checked={s.wordWrap} onChange={(v) => setEditorSetting('wordWrap', v)} />
      </PopoverContent>
    </Popover>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
