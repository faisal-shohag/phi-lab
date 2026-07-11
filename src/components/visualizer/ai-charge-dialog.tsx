'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { AI_CHARGE } from '@/lib/visualizer/challenge'

interface Props {
  open: boolean
  balance: number
  onConfirm: (dontShowAgain: boolean) => void
  onCancel: () => void
}

// One-time confirm before spending XP on helper AI. "Don't show again" is
// remembered by the page (localStorage), so the dialog only appears until the
// learner opts out.
export function AiChargeDialog({ open, balance, onConfirm, onCancel }: Props) {
  const [dontShow, setDontShow] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" /> AI help costs {AI_CHARGE} XP
          </AlertDialogTitle>
          <AlertDialogDescription>
            Asking the AI tutor spends <strong>{AI_CHARGE} XP</strong> each time (repeat questions from the cache are free). You have <strong>{balance} XP</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(v === true)} />
          Don&apos;t show this again
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(dontShow)}>Spend {AI_CHARGE} XP</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
