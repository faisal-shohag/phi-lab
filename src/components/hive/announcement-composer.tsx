'use client'

// Mentors/admins broadcast a pinned notice to the whole Hive. Collapsed by
// default so it never competes with the escalation queue for attention.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MAX_TITLE_LEN } from '@/lib/hive/constants'

export function AnnouncementComposer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (title.trim().length < 5 || body.trim().length < 10) {
      toast.error('An announcement needs a title and a body.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/hive/announcements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not post the announcement.')
        return
      }
      toast.success('Announcement posted and everyone notified.')
      setTitle('')
      setBody('')
      setOpen(false)
      router.push('/hive')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="hive-btn-soft rounded-full" onClick={() => setOpen(true)}>
        <Megaphone className="size-4" /> Post an announcement
      </Button>
    )
  }

  return (
    <Card className="hive-glass gap-3 rounded-xl p-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LEN))}
        placeholder="Announcement title"
        className="hive-glass rounded-xl"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What does the Hive need to know? Markdown supported."
        className="min-h-28"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" className="hive-cta rounded-full px-4" onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Post &amp; notify everyone
        </Button>
      </div>
    </Card>
  )
}
