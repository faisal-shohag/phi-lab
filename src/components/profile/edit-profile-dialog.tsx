'use client'

// The single edit surface for career/profile info. Opened from the hero and the
// completion alert. Fully client-side: seeds from server-provided `info`, PATCHes
// /api/profile on save, then refreshes the server component so the page reflects
// the new values (and completion %). Skills are entered as chips.
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfileInfo } from '@/lib/profile/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'

interface EditProfileDialogProps {
  info: ProfileInfo
  /** Element used as the dialog trigger (rendered via asChild). */
  children: ReactNode
}

export function EditProfileDialog({ info, children }: EditProfileDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [headline, setHeadline] = useState(info.headline ?? '')
  const [bio, setBio] = useState(info.bio ?? '')
  const [goal, setGoal] = useState(info.goal ?? '')
  const [skills, setSkills] = useState<string[]>(info.skills)
  const [skillDraft, setSkillDraft] = useState('')
  const [location, setLocation] = useState(info.location ?? '')
  const [resumeUrl, setResumeUrl] = useState(info.resumeUrl ?? '')
  const [githubUrl, setGithubUrl] = useState(info.githubUrl ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(info.linkedinUrl ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(info.websiteUrl ?? '')
  const [profilePublic, setProfilePublic] = useState(info.profilePublic)

  function addSkill(raw: string) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return
    setSkills((prev) => {
      const seen = new Set(prev.map((s) => s.toLowerCase()))
      const next = [...prev]
      for (const p of parts) {
        if (!seen.has(p.toLowerCase()) && next.length < 20) {
          next.push(p.slice(0, 32))
          seen.add(p.toLowerCase())
        }
      }
      return next
    })
    setSkillDraft('')
  }

  function onSkillKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill(skillDraft)
    } else if (e.key === 'Backspace' && !skillDraft && skills.length) {
      setSkills((prev) => prev.slice(0, -1))
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline, bio, goal, skills, location,
          resumeUrl, githubUrl, linkedinUrl, websiteUrl, profilePublic,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.message ?? 'Could not save your profile.')
        return
      }
      toast.success('Profile updated')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Could not save your profile. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit your profile</DialogTitle>
          <DialogDescription>
            All fields are optional — add what you want to show off.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <Field label="Headline" hint="e.g. Aspiring Frontend Developer">
            <Input value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} placeholder="A short professional title" />
          </Field>

          <Field label="Bio">
            <Textarea value={bio} maxLength={400} onChange={(e) => setBio(e.target.value)} placeholder="A sentence or two about you" />
          </Field>

          <Field label="Career goal" hint="e.g. Land a junior React role in 2026">
            <Input value={goal} maxLength={160} onChange={(e) => setGoal(e.target.value)} placeholder="What are you working towards?" />
          </Field>

          <Field label="Skills" hint="Press Enter or comma to add">
            <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 dark:bg-input/30">
              {skills.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  {s}
                  <button type="button" onClick={() => setSkills((prev) => prev.filter((x) => x !== s))} className="opacity-70 hover:opacity-100">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={onSkillKey}
                onBlur={() => addSkill(skillDraft)}
                placeholder={skills.length ? '' : 'React, TypeScript, SQL…'}
                className="h-6 flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </Field>

          <Field label="Location">
            <Input value={location} maxLength={80} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
          </Field>

          <Field label="Resume / CV link">
            <Input type="url" value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://…" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="GitHub">
              <Input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/…" />
            </Field>
            <Field label="LinkedIn">
              <Input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
            </Field>
            <Field label="Website">
              <Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
            </Field>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium">Public profile</span>
              <span className="block text-xs text-muted-foreground">Anyone with your link can view it. Your email stays private.</span>
            </span>
            <Switch checked={profilePublic} onCheckedChange={setProfilePublic} />
          </label>
        </div>

        <DialogFooter className="mt-5">
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}>Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
