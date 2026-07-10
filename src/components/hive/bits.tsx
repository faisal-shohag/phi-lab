'use client'

// Small shared presentational bits for Hive: author avatar (with a distinct AI
// look), status/type pills, and relative-time helpers used by cards + threads.
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Clock, ShieldAlert, CheckCircle2, Loader2, HelpCircle, ShieldCheck, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HiveAuthorDTO, HivePostStatus, HiveRole } from '@/lib/hive/types'

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** Human "expires in Xh" for the 3-day TTL. */
export function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expiring soon'
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'expires in <1h'
  if (h < 24) return `expires in ${h}h`
  return `expires in ${Math.floor(h / 24)}d`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function HiveAvatar({
  author,
  size = 'md',
}: {
  author: HiveAuthorDTO
  size?: 'sm' | 'md'
}) {
  const cls = size === 'sm' ? 'size-7' : 'size-9'
  if (author.isAI) {
    return (
      <span
        className={cn(
          cls,
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-300 to-orange-500 ring-1 ring-amber-500/30 shadow-sm',
        )}
      >
        <Image
          src="/hive/hive-ai-avatar.png"
          alt="Hive AI"
          width={72}
          height={72}
          className="size-full scale-110 object-cover"
        />
      </span>
    )
  }
  return (
    <Avatar className={cls}>
      {author.image && <AvatarImage src={author.image} alt={author.name} />}
      <AvatarFallback className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        {initials(author.name)}
      </AvatarFallback>
    </Avatar>
  )
}

const STATUS_META: Record<
  HivePostStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  OPEN: { label: 'Open', icon: HelpCircle, className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200' },
  AI_WORKING: {
    label: 'Bee is thinking',
    icon: Loader2,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  ESCALATED: {
    label: 'With a mentor',
    icon: ShieldAlert,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200',
  },
  RESOLVED: {
    label: 'Resolved',
    icon: CheckCircle2,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  ARCHIVED: {
    label: 'Archived',
    icon: CheckCircle2,
    className: 'bg-muted text-muted-foreground',
  },
}

export function StatusBadge({ status }: { status: HivePostStatus }) {
  const m = STATUS_META[status]
  const Icon = m.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        m.className,
      )}
    >
      <Icon className={cn('size-3', status === 'AI_WORKING' && 'animate-spin')} />
      {m.label}
    </span>
  )
}

/**
 * Marks staff next to their name so students can tell an official answer from a
 * classmate's. Students get no badge — an "everyone is labelled" feed is noise.
 */
export function RoleBadge({ role, className }: { role: HiveRole | null | undefined; className?: string }) {
  if (role !== 'MENTOR' && role !== 'ADMIN') return null
  const isAdmin = role === 'ADMIN'
  const Icon = isAdmin ? Crown : ShieldCheck
  return (
    <span
      title={isAdmin ? 'Phi Lab admin' : 'Verified mentor'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1',
        isAdmin
          ? 'bg-violet-100 text-violet-800 ring-violet-500/25 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-400/25'
          : 'bg-emerald-100 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-400/25',
        className,
      )}
    >
      <Icon className="size-3" />
      {isAdmin ? 'Admin' : 'Mentor'}
    </span>
  )
}

const PROVIDER_LABEL: Record<string, string> = {
  GEMINI: 'Gemini',
  OLLAMA: 'Ollama',
  GROQ: 'Groq',
}

/**
 * Which model wrote this. The API only sends `aiProvider` to mentors and
 * admins, so rendering it unconditionally is safe — students receive null.
 */
export function ProviderBadge({ provider }: { provider: string | null | undefined }) {
  if (!provider) return null
  return (
    <span
      title="Visible to mentors and admins only"
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-400/20"
    >
      {PROVIDER_LABEL[provider] ?? provider}
    </span>
  )
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Badge variant="outline" className="text-[11px] font-normal">
      #{tag}
    </Badge>
  )
}
