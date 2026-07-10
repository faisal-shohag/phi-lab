'use client'

// One reply in a thread. AI replies get an amber "Hive AI" treatment and an
// attempt label; peer answers can show a Bee-Approved mark (Phase 3). The
// asker sees an "Accept answer" action on non-own answers (Phase 3 wires it).
import { CheckCircle2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HiveAvatar, ProviderBadge, RoleBadge, timeAgo } from './bits'
import { HiveMarkdown } from './markdown'
import { NectarButton } from './nectar-button'
import type { HiveReplyDTO } from '@/lib/hive/types'

export function ReplyItem({
  reply,
  canAccept,
  onAccept,
  accepting,
}: {
  reply: HiveReplyDTO
  canAccept?: boolean
  onAccept?: (replyId: string) => void
  accepting?: boolean
}) {
  const isAI = reply.authorType === 'AI'
  return (
    <div
      className={cn(
        'hive-glass rounded-xl p-4',
        isAI && 'border-amber-300/60 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-950/25',
        reply.isAccepted &&
          'border-emerald-400/70 bg-emerald-50/70 dark:border-emerald-800/60 dark:bg-emerald-950/25',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <HiveAvatar author={reply.author} size="sm" />
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{reply.author.name}</span>
          {isAI && reply.aiAttempt && (
            <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-800/50 dark:text-amber-100">
              attempt {reply.aiAttempt}
            </span>
          )}
          {/* null for students — the API withholds it */}
          <ProviderBadge provider={reply.aiProvider} />
          <RoleBadge role={reply.author.role} />
          {reply.kind === 'CLARIFYING_QUESTION' && (
            <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
              <HelpCircle className="size-3" /> needs info
            </span>
          )}
          <span>·</span>
          <span>{timeAgo(reply.createdAt)}</span>
        </div>
        {reply.isAccepted && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" /> Accepted
          </span>
        )}
        {reply.verification === 'APPROVED' && !reply.isAccepted && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300"
            title={reply.verifyNote ?? 'Verified by Hive AI'}
          >
            🐝 Bee-Approved
          </span>
        )}
      </div>

      <HiveMarkdown>{reply.body}</HiveMarkdown>

      {reply.images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {reply.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="attachment" className="max-h-48 rounded-md border" />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <NectarButton
          targetType="reply"
          targetId={reply.id}
          initialCount={reply.nectar}
          initialReacted={reply.reactedByMe}
        />
        {canAccept && !reply.isAccepted && (
          <Button
            size="sm"
            variant="outline"
            className="hive-btn-soft rounded-full"
            onClick={() => onAccept?.(reply.id)}
            disabled={accepting}
          >
            <CheckCircle2 className="size-4" /> Accept this answer
          </Button>
        )}
      </div>
    </div>
  )
}
