'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { History, LogOut, Loader2, Trophy } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

interface UserMenuProps {
  /** Show a "History" shortcut inside the menu. */
  showHistory?: boolean
}

export function UserMenu({ showHistory = true }: UserMenuProps) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [signingOut, setSigningOut] = useState(false)

  if (isPending) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
  }

  const user = session?.user
  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    )
  }

  async function signOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <Avatar>
          {user.image && <AvatarImage src={user.image} alt={user.name ?? 'User'} />}
          <AvatarFallback className="bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 text-xs font-semibold text-white">
            {initials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
          <Avatar size="lg">
            {user.image && <AvatarImage src={user.image} alt={user.name ?? 'User'} />}
            <AvatarFallback className="bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 text-sm font-semibold text-white">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user.name || 'Learner'}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <Trophy className="h-4 w-4" />
            Achievements
          </Link>
        </DropdownMenuItem>
        {showHistory && (
          <DropdownMenuItem asChild>
            <Link href="/labs/interview/history">
              <History className="h-4 w-4" />
              Interview history
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); void signOut() }} disabled={signingOut}>
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
