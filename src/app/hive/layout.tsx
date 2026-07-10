import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getHiveUser } from '@/lib/hive/roles'
import { HiveNav } from '@/components/hive/hive-nav'

export const metadata: Metadata = {
  title: 'Hive — AI Helpdesk',
  description:
    'Post a coding problem and get an instant answer from the Hive AI, with human mentors a click away.',
}

// The `data-theme="hive"` wrapper re-tints every shadcn component inside to the
// bee/honey palette without touching the global theme (see globals.css).
// `.hive-shell` paints the ambient amber canvas the frosted cards float on.
export default async function HiveLayout({ children }: { children: React.ReactNode }) {
  const user = await getHiveUser()
  if (!user) redirect('/sign-in?redirect=/hive')

  return (
    <div data-theme="hive" className="hive-shell min-h-screen bg-background">
      {/* Decorative comb anchored to the top-left corner. `-z-[1]` puts it at the
          same depth as `.hive-shell::before` — since it comes after that pseudo
          element in paint order, it sits on top of the gradient instead of
          being hidden behind it (which `-z-10` did). */}
      <Image
        src="/hive/hex-corner.png"
        alt=""
        aria-hidden
        width={450}
        height={450}
        priority={false}
        className="pointer-events-none fixed -left-10 -top-10 -z-[1] w-64 select-none opacity-30 md:w-80 dark:opacity-[0.12]"
      />

      <HiveNav role={user.role} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
