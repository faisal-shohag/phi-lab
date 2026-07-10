'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserFiltersProps {
  initialQuery: string
  initialRole: string
}

/**
 * Pushes filters into the URL so the page (a Server Component) re-renders with
 * them. Resets to page 1 on every change — staying on page 7 of a narrower
 * result set would show an empty table.
 */
export function UserFilters({ initialQuery, initialRole }: UserFiltersProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [role, setRole] = useState(initialRole)

  const apply = (nextQuery: string, nextRole: string) => {
    const params = new URLSearchParams()
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    if (nextRole !== 'ALL') params.set('role', nextRole)
    router.push(`/admin/users${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        apply(query, role)
      }}
    >
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="pl-8"
          aria-label="Search users"
        />
      </div>

      <Select
        value={role}
        onValueChange={(v) => {
          setRole(v)
          apply(query, v)
        }}
      >
        <SelectTrigger className="w-40" aria-label="Filter by role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All roles</SelectItem>
          <SelectItem value="STUDENT">Student</SelectItem>
          <SelectItem value="MENTOR">Mentor</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  )
}
