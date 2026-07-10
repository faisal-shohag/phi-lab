'use client'

// The full thread: the question, its replies, and a reply box. Polls the detail
// endpoint while the AI is working so a fresh answer appears without a manual
// refresh. Author-only controls (Still stuck / Need a human / Accept) light up
// as later phases wire their endpoints.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell, BellOff, ImagePlus, Loader2, Send, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { HiveAvatar, RoleBadge, StatusBadge, TagBadge, timeAgo, expiresIn } from './bits'
import { HiveMarkdown } from './markdown'
import { ReplyItem } from './reply-item'
import { DeletePostDialog } from './delete-post-dialog'
import { StatusTimeline } from './status-timeline'
import { useImageUpload } from './use-image-upload'
import type { HivePostDetailDTO, HiveViewer } from '@/lib/hive/types'

export function PostThread({
  initial,
  viewer,
}: {
  initial: HivePostDetailDTO
  viewer: HiveViewer
}) {
  const router = useRouter()
  const [post, setPost] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [following, setFollowing] = useState(initial.followedByMe)

  const isAuthor = post.author.id === viewer.id
  const isStaff = viewer.role === 'MENTOR' || viewer.role === 'ADMIN'
  const isQuestion = post.type === 'QUESTION'
  const canReply = post.status !== 'ARCHIVED'
  const canAccept = isAuthor && (post.status === 'OPEN' || post.status === 'AI_WORKING' || post.status === 'ESCALATED')

  const reload = useCallback(async () => {
    const res = await fetch(`/api/hive/posts/${post.id}`)
    if (res.ok) {
      const data = await res.json()
      setPost(data.post)
    }
  }, [post.id])

  // Poll while the AI is composing an answer.
  useEffect(() => {
    if (post.status !== 'AI_WORKING') return
    const t = setInterval(reload, 4000)
    return () => clearInterval(t)
  }, [post.status, reload])

  async function accept(replyId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/hive/posts/${post.id}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ replyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not accept the answer.')
        return
      }
      toast.success('Marked as resolved. Archiving to Honeycomb. 🍯')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function deletePost(reason: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/hive/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.message ?? 'Could not delete this post.')
        return
      }
      toast.success('Post deleted.')
      router.push('/hive')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function toggleFollow() {
    const prev = following
    setFollowing(!prev) // optimistic; the unique constraint is the source of truth
    try {
      const res = await fetch(`/api/hive/posts/${post.id}/follow`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setFollowing((await res.json()).following)
    } catch {
      setFollowing(prev)
      toast.error('Could not update notifications for this post.')
    }
  }

  async function escalate() {
    setBusy(true)
    try {
      const res = await fetch(`/api/hive/posts/${post.id}/escalate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not reach a mentor.')
        return
      }
      toast.success('A mentor has been notified.')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/hive')} className="-ml-2">
          ← Back to the Hive
        </Button>
        <div className="flex items-center gap-2">
          {!isAuthor && (
            <Button variant="ghost" size="sm" onClick={toggleFollow}>
              {following ? <BellOff className="size-4" /> : <Bell className="size-4" />}
              {following ? 'Unfollow' : 'Follow'}
            </Button>
          )}
          {isStaff && <DeletePostDialog title={post.title} busy={busy} onConfirm={deletePost} />}
        </div>
      </div>

      <Card className="hive-glass gap-0 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <HiveAvatar author={post.author} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{post.author.name}</span>
              <RoleBadge role={post.author.role} />
              <span>·</span>
              <span>{timeAgo(post.createdAt)}</span>
              {isQuestion && post.status !== 'RESOLVED' && (
                <>
                  <span>·</span>
                  <span>{expiresIn(post.expiresAt)}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-xl font-semibold leading-snug">{post.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isQuestion && <StatusBadge status={post.status} />}
              {post.tags.map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <HiveMarkdown>{post.body}</HiveMarkdown>
        </div>

        {post.images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.images.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="attachment" className="max-h-72 rounded-md border" />
            ))}
          </div>
        )}
      </Card>

      {/* Staff-only: why this reached a human, and whether the AI tried first.
          `escalationReason` is null for students, so this never renders for them. */}
      {post.escalationReason && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-purple-300/60 bg-purple-50/70 px-3 py-2 text-xs text-purple-900 dark:border-purple-800/50 dark:bg-purple-950/25 dark:text-purple-200">
          <ShieldAlert className="size-3.5" />
          <span className="font-medium">
            {post.escalatedAfterAiReplies ? 'Partial hand-over' : 'Direct hand-over'}
          </span>
          <span>·</span>
          <span>{post.escalationReason}</span>
          <span>·</span>
          <span>
            {post.escalatedAfterAiReplies ?? 0} AI{' '}
            {post.escalatedAfterAiReplies === 1 ? 'reply' : 'replies'} first
          </span>
        </div>
      )}

      {isQuestion && <StatusTimeline events={post.events} />}

      {post.status === 'AI_WORKING' && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 backdrop-blur dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-200">
          <HiveAvatar author={{ id: null, name: 'Hive AI', image: null, isAI: true, role: null }} size="sm" />
          <span className="flex-1">Hive AI is looking into your problem…</span>
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}

      {post.replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}
          </h2>
          {post.replies.map((r) => (
            <ReplyItem
              key={r.id}
              reply={r}
              // You can't accept your own reply — the server rejects it too.
              canAccept={canAccept && r.author.id !== viewer.id}
              onAccept={accept}
              accepting={busy}
            />
          ))}
        </div>
      )}

      {isAuthor && isQuestion && post.status !== 'RESOLVED' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="hive-btn-soft rounded-full" onClick={escalate} disabled={busy}>
            <ShieldAlert className="size-4" /> Need a human
          </Button>
        </div>
      )}

      {canReply && (
        <ReplyBox postId={post.id} isAuthor={isAuthor} onPosted={reload} />
      )}
    </div>
  )
}

function ReplyBox({
  postId,
  isAuthor,
  onPosted,
}: {
  postId: string
  isAuthor: boolean
  onPosted: () => void | Promise<void>
}) {
  const [body, setBody] = useState('')
  const [stillStuck, setStillStuck] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { images, uploading, error, upload, remove } = useImageUpload()

  async function submit() {
    if (body.trim().length < 2) return toast.error('Write a reply first.')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/hive/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body, images, stillStuck: isAuthor && stillStuck }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not post your reply.')
        return
      }
      setBody('')
      setStillStuck(false)
      await onPosted()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="hive-glass gap-3 rounded-xl p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isAuthor ? 'Add more detail, or tell the Hive if you got unstuck…' : 'Share what worked for you. Markdown + code supported.'}
        className="hive-glass min-h-24 rounded-xl font-mono text-sm"
      />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="attachment" className="size-16 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </Button>
          {isAuthor && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={stillStuck} onChange={(e) => setStillStuck(e.target.checked)} />
              Still stuck — ask the Hive to try again
            </label>
          )}
        </div>
        <Button size="sm" onClick={submit} disabled={submitting || uploading} className="hive-cta rounded-full px-4">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Reply
        </Button>
      </div>
    </Card>
  )
}
