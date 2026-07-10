'use client'

// A single feed row. Announcements/encouragement render with a distinct amber
// banner; questions show status, tags, and reply/nectar counts. The whole card
// links to the thread.
import Link from 'next/link'
import { MessageSquare, Pin, Megaphone } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { HiveAvatar, ProviderBadge, RoleBadge, StatusBadge, TagBadge, timeAgo } from './bits'
import type { HivePostCardDTO } from '@/lib/hive/types'

/**
 * A prose-only teaser. Fenced blocks are dropped entirely — flattening them
 * yields gibberish ("const doubled = nums.map(n = { n 2 })"). Inline code keeps
 * its text, since removing it strands the sentence around it ("Expected but
 * got ."). Images/links collapse to their alt/label.
 */
function excerpt(markdown: string): string {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced blocks
    .replace(/`([^`]*)`/g, '$1') // inline code → its text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images → their text
    .replace(/^\s{0,3}[#>-]\s*/gm, '') // headings, quotes, bullets
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return prose.slice(0, 200)
}

export function PostCard({ post }: { post: HivePostCardDTO }) {
  const special = post.type !== 'QUESTION'
  return (
    <Link href={`/hive/${post.id}`} className="block">
      <Card
        className={cn(
          'hive-glass hive-lift gap-0 rounded-xl p-4 hover:border-primary/45',
          special && 'border-primary/40 bg-primary/[0.07]',
        )}
      >
        <div className="flex items-start gap-3">
          {post.type === 'ANNOUNCEMENT' ? (
            <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Megaphone className="size-4" />
            </span>
          ) : (
            // Questions show their author; encouragement posts are AI-authored,
            // so HiveAvatar renders Hive AI's face for them too.
            <div className="mt-0.5">
              <HiveAvatar author={post.author} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{post.author.name}</span>
              <RoleBadge role={post.author.role} />
              <ProviderBadge provider={post.aiProvider} />
              <span>·</span>
              <span>{timeAgo(post.createdAt)}</span>
              {post.pinned && (
                <span className="inline-flex items-center gap-0.5 text-primary">
                  <Pin className="size-3" /> Pinned
                </span>
              )}
            </div>

            <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{post.title}</h3>

            {!special && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{excerpt(post.body)}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {post.type === 'QUESTION' && <StatusBadge status={post.status} />}
              {post.tags.slice(0, 3).map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="size-3.5" />
                {post.replyCount}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
