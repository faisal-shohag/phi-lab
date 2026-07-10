'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { SETTING_BOUNDS, type SettingKey, type Settings } from '@/lib/admin/settings-defaults'

interface SettingsFormProps {
  initial: Settings
}

interface NumberField {
  key: SettingKey
  label: string
  hint: string
}

const LAB_SECTIONS: { title: string; description: string; flag: SettingKey; numbers: NumberField[] }[] = [
  {
    title: 'Mock Interview',
    description: 'Live voice technical interview, graded afterwards.',
    flag: 'flag.lab.interview.enabled',
    numbers: [
      { key: 'lab.interview.roundSeconds', label: 'Round length (seconds)', hint: 'The prompt and the timer both follow this.' },
      { key: 'lab.interview.dailyLimit', label: 'Rounds per user per day', hint: '0 blocks new rounds entirely.' },
    ],
  },
  {
    title: 'Feynman',
    description: 'Teach-back: the learner explains, the AI plays a beginner.',
    flag: 'flag.lab.feynman.enabled',
    numbers: [
      { key: 'lab.feynman.roundSeconds', label: 'Round length (seconds)', hint: 'The prompt and the timer both follow this.' },
      { key: 'lab.feynman.dailyLimit', label: 'Rounds per user per day', hint: '0 blocks new rounds entirely.' },
    ],
  },
  {
    title: 'English',
    description: 'Spoken technical-English practice.',
    flag: 'flag.lab.english.enabled',
    numbers: [
      { key: 'lab.english.roundSeconds', label: 'Round length (seconds)', hint: 'The prompt and the timer both follow this.' },
      { key: 'lab.english.dailyLimit', label: 'Rounds per user per day', hint: '0 blocks new rounds entirely.' },
    ],
  },
  {
    title: 'Support',
    description: 'Live voice support. Capped platform-wide; everyone else queues.',
    flag: 'flag.lab.support.enabled',
    numbers: [
      { key: 'lab.support.roundSeconds', label: 'Session length (seconds)', hint: 'Also sizes the Gemini token lifetime.' },
      { key: 'lab.support.maxActiveSessions', label: 'Concurrent live sessions', hint: 'Across the whole platform, not per user.' },
    ],
  },
  {
    title: 'Analogies',
    description: 'One-shot analogy card generation.',
    flag: 'flag.lab.analogies.enabled',
    numbers: [{ key: 'lab.analogies.dailyLimit', label: 'Cards per user per day', hint: '0 blocks new cards entirely.' }],
  },
]

const PROVIDER_FLAGS: { key: SettingKey; label: string }[] = [
  { key: 'flag.provider.gemini.parked', label: 'Gemini' },
  { key: 'flag.provider.ollama.parked', label: 'Ollama' },
  { key: 'flag.provider.groq.parked', label: 'Groq' },
]

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<Settings>(initial)
  const [saving, setSaving] = useState(false)

  // Only send what actually moved, so the audit log records real changes rather
  // than a full rewrite every time someone opens the page.
  const dirty = useMemo(() => {
    const changed: Partial<Record<SettingKey, number | boolean>> = {}
    for (const key of Object.keys(initial) as SettingKey[]) {
      if (values[key] !== initial[key]) changed[key] = values[key]
    }
    return changed
  }, [values, initial])

  const dirtyCount = Object.keys(dirty).length

  const setValue = (key: SettingKey, value: number | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: dirty }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(typeof body?.message === 'string' ? body.message : 'Could not save settings.')
        return
      }
      toast.success(`Saved ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}.`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const numberInput = (field: NumberField) => {
    const bounds = SETTING_BOUNDS[field.key]
    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={field.key}>{field.label}</Label>
        <Input
          id={field.key}
          type="number"
          inputMode="numeric"
          min={bounds?.min}
          max={bounds?.max}
          value={String(values[field.key])}
          onChange={(e) => setValue(field.key, Number(e.target.value))}
        />
        <p className="text-muted-foreground text-xs">
          {field.hint}
          {bounds ? ` Allowed ${bounds.min}–${bounds.max}.` : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {LAB_SECTIONS.map((section) => {
        const enabled = values[section.flag] as boolean
        return (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label htmlFor={section.flag} className="text-muted-foreground text-xs">
                    {enabled ? 'Enabled' : 'Disabled'}
                  </Label>
                  <Switch
                    id={section.flag}
                    checked={enabled}
                    onCheckedChange={(v) => setValue(section.flag, v)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">{section.numbers.map(numberInput)}</div>
              {!enabled ? (
                <p className="text-muted-foreground mt-4 text-xs">
                  While disabled, this lab refuses to start new sessions. Sessions already running
                  are unaffected.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader>
          <CardTitle>Hive</CardTitle>
          <CardDescription>The AI helpdesk.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {numberInput({
            key: 'hive.dailyCoachLimit',
            label: 'Coach uses per user per day',
            hint: 'The pre-post draft coach.',
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI providers</CardTitle>
          <CardDescription>
            Park a provider to take it out of the Hive failover chain. This is separate from the
            automatic cooldown that a rate limit triggers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROVIDER_FLAGS.map((p, i) => {
            const parked = values[p.key] as boolean
            return (
              <div key={p.key}>
                {i > 0 ? <Separator className="mb-4" /> : null}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={p.key} className="font-medium">
                      {p.label}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {parked ? 'Parked — never selected.' : 'In rotation.'}
                    </p>
                  </div>
                  <Switch
                    id={p.key}
                    checked={parked}
                    onCheckedChange={(v) => setValue(p.key, v)}
                  />
                </div>
              </div>
            )
          })}
          <p className="text-muted-foreground text-xs">
            Parking every provider stops Hive answering questions at all; posts will escalate
            straight to a mentor.
          </p>
        </CardContent>
      </Card>

      {dirtyCount > 0 ? (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 border-t p-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-sm">
              {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setValues(initial)} disabled={saving}>
                Discard
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
