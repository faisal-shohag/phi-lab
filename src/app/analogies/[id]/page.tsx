import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import type { AnalogyCardData, AnalogyLanguage } from '@/lib/analogies/concepts'
import { AnalogyCard } from '@/components/analogies/analogy-card'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

// Shared by generateMetadata and the page component — cache() dedupes the
// lookup so both share one DB round trip instead of two.
const loadCard = cache((id: string) => prisma.analogyCard.findUnique({ where: { id } }))

// Public share page — anyone with the link can view the analogy card.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const card = await loadCard(id)
  if (!card) return { title: 'Analogy' }
  return {
    title: `${card.title} — ${card.concept} explained`,
    description: `${card.concept}, explained with an everyday analogy. Made with Phi Lab.`,
  }
}

export default async function AnalogySharePage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const row = await loadCard(id)
  if (!row) notFound()

  const data: AnalogyCardData = {
    id: row.id,
    concept: row.concept,
    language: row.language as AnalogyLanguage,
    title: row.title,
    scene: row.scene,
    mapping: row.mapping as unknown as AnalogyCardData['mapping'],
    soBasically: row.soBasically,
    techNote: row.techNote,
    emoji: row.emoji,
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 via-white to-rose-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-sm font-bold">Phi Lab</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <AnimatedThemeToggler />
            <Button asChild size="sm">
              <Link href="/labs/analogies">Make your own</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-10">
        <AnalogyCard data={data} />
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">Want any concept explained like this?</p>
          <Button asChild className="mt-2 bg-linear-to-r from-amber-500 to-rose-500">
            <Link href="/labs/analogies">Open Rickshaw Analogies</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
