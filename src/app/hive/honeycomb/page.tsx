import Image from 'next/image'
import { HoneycombSearch } from '@/components/hive/honeycomb-search'

export default function HoneycombPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Honeycomb</h1>
          <p className="text-sm text-muted-foreground">
            Every solved question, distilled and kept forever. Search before you ask.
          </p>
        </div>
      </div>
      <HoneycombSearch />
    </div>
  )
}
