'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PhoneOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Force-ending is the escape hatch for a round wedged at IN_PROGRESS whose learner
// is already gone — a killed browser or a slept laptop, the cases the unload beacon
// cannot cover. It is confirmed because it is not always obvious from a table row
// that nobody is on the other end: if the learner IS still there, this hangs up on
// them mid-sentence.
interface ForceEndButtonProps {
  sessionId: string
  feature: 'INTERVIEW' | 'FEYNMAN' | 'ENGLISH' | 'SUPPORT'
  lab: string
  learner: string
  /** True when the session has outlived its round — almost certainly a dead tab. */
  stale: boolean
}

export function ForceEndButton({ sessionId, feature, lab, learner, stale }: ForceEndButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  async function forceEnd() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/labs/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, sessionId }),
      })
      if (!res.ok) {
        let message = 'Could not end the session.'
        try {
          const body = await res.json()
          if (typeof body?.message === 'string') message = body.message
        } catch {}
        toast.error(message)
        return
      }
      // `ended: false` means the round finished on its own between the page
      // rendering and this click. The admin's intent is satisfied either way —
      // say so honestly rather than claiming an action that never happened.
      const { ended } = (await res.json()) as { ended: boolean }
      toast.success(ended ? `${lab} session ended.` : 'That session had already ended.')
      setOpen(false)
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <PhoneOff className="size-3.5" />
        End
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this {lab} session?</DialogTitle>
            <DialogDescription>
              {stale
                ? `This session has outlived its round, so ${learner} has almost certainly closed the tab. Ending it marks it abandoned and, for Support, frees the slot for the next person in the queue.`
                : `${learner} may still be in this session — ending it will hang up on them mid-conversation. It will be marked abandoned, and they will not get a report.`}{' '}
              This is recorded in the audit log and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void forceEnd()} disabled={busy}>
              {busy ? 'Ending…' : 'End session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
