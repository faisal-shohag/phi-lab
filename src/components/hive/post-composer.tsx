'use client'

// Ask-a-question composer: title, markdown body with Write/Preview tabs and a
// tiny toolbar, tag chips, and drag-drop/click image upload. On submit it POSTs
// to /api/hive/posts and routes to the new thread (where the AI answer streams
// in from Phase 2). Coach + similar-posts panels are wired in later phases.
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Code2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { HIVE_TAGS, MAX_TITLE_LEN } from '@/lib/hive/constants'
import { HiveMarkdown } from './markdown'
import { CoachSuggestions } from './coach-suggestions'
import { SimilarPosts } from './similar-posts'
import { useImageUpload } from './use-image-upload'

export function PostComposer() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { images, uploading, error: uploadError, upload, remove } = useImageUpload()

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 3 ? [...prev, tag] : prev,
    )
  }

  function insertCodeBlock() {
    const el = bodyRef.current
    const snippet = '\n```js\n// your code\n```\n'
    if (!el) {
      setBody((b) => b + snippet)
      return
    }
    const start = el.selectionStart
    setBody((b) => b.slice(0, start) + snippet + b.slice(el.selectionEnd))
  }

  async function submit() {
    if (title.trim().length < 5) return toast.error('Give your question a clear title.')
    if (body.trim().length < 10) return toast.error('Describe your problem in a bit more detail.')
    setSubmitting(true)
    try {
      const res = await fetch('/api/hive/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, images, tags }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not post your question.')
        return
      }
      toast.success('Posted! The Hive is on it. 🐝')
      router.push(`/hive/${data.post.id}`)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LEN))}
          placeholder="What's the problem? Be specific — e.g. 'map() returns undefined for nested array'"
          className="hive-glass h-12 rounded-xl text-base"
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {title.length}/{MAX_TITLE_LEN}
        </div>
      </div>

      <SimilarPosts title={title} body={body} />

      <Tabs defaultValue="write">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={insertCodeBlock}>
              <Code2 className="size-4" /> Code
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Image
            </Button>
          </div>
        </div>

        <TabsContent value="write" className="mt-2">
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
            }}
            onDragOver={(e) => e.preventDefault()}
            placeholder={
              'Describe what you tried, what you expected, and what happened.\n\nMarkdown supported. Fenced ```js blocks get an "Open in Visualizer" button.'
            }
            className="hive-glass min-h-52 rounded-xl font-mono text-sm"
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className="hive-glass min-h-52 rounded-xl p-4">
            {body.trim() ? (
              <HiveMarkdown>{body}</HiveMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="attachment" className="size-20 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Tags <span className="font-normal">(up to 3)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HIVE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition',
                tags.includes(tag)
                  ? 'hive-cta'
                  : 'hive-btn-soft text-muted-foreground hover:text-foreground',
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <CoachSuggestions title={title} body={body} onApplyTitle={setTitle} />

      <div className="flex justify-end gap-2">
        <Button variant="outline" className="hive-btn-soft rounded-full" onClick={() => router.push('/hive')} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting || uploading} className="hive-cta rounded-full px-5">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Post to the Hive
        </Button>
      </div>
    </div>
  )
}
