import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSharedWin } from '@/lib/visualizer/challenge-share'

// Public victory page for a won challenge. No auth — anyone with the link can
// view the boast. Only safe fields are read (no tests / no solution).

const DIFF_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const MODE_LABEL: Record<string, string> = { oneshot: 'One-shot', retries: 'Retries', timed: 'Timed' }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const win = await getSharedWin(id)
  if (!win) return { title: 'Challenge · Js Motion Lab' }
  const title = `${win.name} beat a ${DIFF_LABEL[win.difficulty] ?? win.difficulty} challenge · Js Motion Lab`
  const description = `+${win.wonXp} XP${win.winStreak > 1 ? ` · ${win.winStreak}-win streak 🔥` : ''} — take your own coding challenge on Js Motion Lab.`
  // The sibling opengraph-image.tsx is auto-attached by Next as the og:image.
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } }
}

export default async function ChallengeSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const win = await getSharedWin(id)
  if (!win) notFound()

  return (
    <div className="min-h-screen bg-linear-to-br from-rose-950 via-zinc-950 to-orange-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border-2 border-rose-500/40 bg-black/40 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-rose-300">Js Motion Lab · PhiLab</div>
        <div className="text-5xl">🏆</div>
        <h1 className="mt-3 text-2xl font-black">{win.name} won a challenge!</h1>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <span className="rounded-full bg-rose-500/20 px-3 py-1 font-mono font-bold text-rose-200">{DIFF_LABEL[win.difficulty] ?? win.difficulty}</span>
          <span className="rounded-full bg-orange-500/20 px-3 py-1 font-mono font-bold text-orange-200">{MODE_LABEL[win.mode] ?? win.mode}</span>
        </div>
        <div className="mt-5 font-mono text-4xl font-black text-emerald-400">+{win.wonXp} XP</div>
        {win.winStreak > 1 && <div className="mt-1 text-sm font-bold text-rose-300">🔥 {win.winStreak}-win streak</div>}
        <p className="mt-5 rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-white/80" style={{ fontFamily: 'var(--font-bengali)' }}>
          {win.prompt}
        </p>
        <Link
          href="/labs/js-motion"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-linear-to-r from-rose-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90"
        >
          Take your own challenge →
        </Link>
        <div className="mt-3 text-[11px] text-white/40">{new Date(win.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  )
}
