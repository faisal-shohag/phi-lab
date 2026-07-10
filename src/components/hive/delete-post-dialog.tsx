'use client'

// Moderator delete. Irreversible and cascading — it takes the replies, the
// timeline and the reactions with it — so it asks for confirmation and offers a
// reason, which the author receives as a notification. Deleting someone's
// question with no explanation is how a community stops asking questions.
import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function DeletePostDialog({
  title,
  busy,
  onConfirm,
}: {
  title: string
  busy?: boolean
  onConfirm: (reason: string) => void | Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="rounded-full" disabled={busy}>
          <Trash2 className="size-4" /> Delete post
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">&ldquo;{title}&rdquo;</span> and all of its
            replies, reactions and history will be permanently removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="delete-reason" className="text-sm font-medium">
            Reason <span className="font-normal text-muted-foreground">(sent to the author)</span>
          </label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. duplicate of an existing thread, or shares another student's assignment code"
            className="min-h-20"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault()
              await onConfirm(reason)
              setOpen(false)
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
