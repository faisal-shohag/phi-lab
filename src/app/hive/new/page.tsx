import Image from 'next/image'
import { PostComposer } from '@/components/hive/post-composer'

export default function NewHivePostPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Image
          src="/hive/honeycomb.png"
          alt=""
          aria-hidden
          width={96}
          height={96}
          className="size-11 select-none drop-shadow-sm"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ask the Hive</h1>
          <p className="text-sm text-muted-foreground">
            Describe your problem clearly. The Hive AI answers first; a mentor steps in if it can&apos;t.
          </p>
        </div>
      </div>
      <PostComposer />
    </div>
  )
}
