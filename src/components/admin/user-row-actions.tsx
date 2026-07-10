'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, ShieldCheck, ShieldOff, UserCog } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Role } from '@/generated/prisma/client'

const ROLES: Role[] = ['STUDENT', 'MENTOR', 'ADMIN']

interface UserRowActionsProps {
  user: { id: string; name: string; role: Role; suspendedAt: string | null }
  /** The signed-in admin. Self-actions are disabled in the UI as well as the API. */
  actorId: string
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return typeof body?.message === 'string' ? body.message : 'Something went wrong.'
  } catch {
    return 'Something went wrong.'
  }
}

export function UserRowActions({ user, actorId }: UserRowActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const isSelf = user.id === actorId
  const suspended = user.suspendedAt !== null

  // The API enforces these too. Disabling them here is courtesy, not security.
  const refresh = () => startTransition(() => router.refresh())

  async function changeRole(role: Role) {
    if (role === user.role) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      toast.success(`${user.name} is now ${role.toLowerCase()}.`)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function suspend() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      toast.success(`${user.name} has been suspended.`)
      setSuspendOpen(false)
      setReason('')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function unsuspend() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      toast.success(`${user.name} has been reinstated.`)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={busy || pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions for {user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserCog className="size-3.5" /> Role
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={user.role}
            onValueChange={(v) => void changeRole(v as Role)}
          >
            {ROLES.map((role) => (
              <DropdownMenuRadioItem key={role} value={role} disabled={isSelf} className="capitalize">
                {role.toLowerCase()}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          {suspended ? (
            <DropdownMenuItem onSelect={() => void unsuspend()}>
              <ShieldCheck className="size-3.5" /> Reinstate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onSelect={(e) => {
                e.preventDefault()
                setSuspendOpen(true)
              }}
            >
              <ShieldOff className="size-3.5" /> Suspend
            </DropdownMenuItem>
          )}

          {isSelf ? (
            <p className="text-muted-foreground px-2 py-1.5 text-xs">
              You cannot change your own access.
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {user.name}?</DialogTitle>
            <DialogDescription>
              They will be signed out and blocked from every lab and from Hive. The reason is
              recorded in the audit log. This can be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this account being suspended?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void suspend()}
              disabled={busy || !reason.trim()}
            >
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
