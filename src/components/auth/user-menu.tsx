'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { History, LogOut, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { Role } from '@/generated/prisma/client'

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

/** Same visual weight as the admin users table, so a role reads the same everywhere. */
const ROLE_VARIANT: Record<Role, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  MENTOR: 'secondary',
  STUDENT: 'outline',
}

/**
 * The caller's role. Null while loading, signed out, or suspended. Fetched
 * rather than read off the session, which has no role and is cookie-cached —
 * see src/app/api/me/route.ts.
 */
function useRole(signedIn: boolean): Role | null {
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    // No synchronous reset when signed out: the menu renders a Sign-in button
    // and never reads `role`, and setState in an effect body cascades renders.
    if (!signedIn) return

    // Guards a response landing after unmount or after the session flips.
    let active = true
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (active && body?.role) setRole(body.role as Role)
      })
      .catch(() => {
        // A missing badge is better than a broken nav.
      })
    return () => {
      active = false
    }
  }, [signedIn])

  return role
}

interface UserMenuProps {
  /** Show a "History" shortcut inside the menu. */
  showHistory?: boolean
}

export function UserMenu({ showHistory = true }: UserMenuProps) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [signingOut, setSigningOut] = useState(false)
  // Called before the early returns below — hooks cannot be conditional.
  const role = useRole(Boolean(session?.user))

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
          {user.image && <AvatarImage referrerPolicy='no-referrer' src={user.image} alt={user.name ?? 'User'} />}
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
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{user.name || 'Learner'}</span>
              {role && (
                <Badge variant={ROLE_VARIANT[role]} className="shrink-0 px-1.5 py-0 text-[10px] font-medium capitalize">
                  {role.toLowerCase()}
                </Badge>
              )}
            </div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound className="h-4 w-4" />
            Profile
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
        {role === 'ADMIN' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4" />
                Admin dashboard
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); void signOut() }} disabled={signingOut}>
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
