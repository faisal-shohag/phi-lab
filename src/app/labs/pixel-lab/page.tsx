'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import { ChevronUp, Clock, Code2, Grid2x2Check, Loader2, Lock, Map as MapIcon, Play, Target, Trophy } from 'lucide-react'
import { toast } from 'sonner'

import { UserMenu } from '@/components/auth/user-menu'
import { LeaderboardSheet } from '@/components/gamification/leaderboard-sheet'
import { XpBadge } from '@/components/gamification/xp-badge'
import { XpHint } from '@/components/gamification/xp-hint'
import { BriefScroll } from '@/components/pixel/brief-scroll'
import { ChallengeMap } from '@/components/pixel/challenge-map'
import { CompareStage } from '@/components/pixel/compare-stage'
import { HistorySheet, type Submission } from '@/components/pixel/history-sheet'
import { MiniMap } from '@/components/pixel/mini-map'
import { PixelEditor, type PixelLang } from '@/components/pixel/pixel-editor'
import { ScorePanel, type ScoreResult } from '@/components/pixel/score-panel'
import { SettingsMenu, usePixelSettings } from '@/components/pixel/settings-menu'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authClient } from '@/lib/auth-client'
import { refreshXp } from '@/lib/gamification/use-xp'
import { PIXEL_TOPICS, type PixelChallenge } from '@/lib/pixel/challenges'
import { loadDraft, saveDraft } from '@/lib/pixel/drafts'
import type { FrameSource } from '@/lib/pixel/harness'
import { TIER_LABEL, type Tier } from '@/lib/pixel/score'
import { getSettings } from '@/lib/pixel/settings'
import { playSound, preloadSounds } from '@/lib/pixel/sound'
import {
  crossedMilestone,
  nextChallengeId,
  unlockStates,
  type TiersByChallenge,
} from '@/lib/pixel/unlock'
import { cn } from '@/lib/utils'

const FIRST = PIXEL_TOPICS[0].challenges[0]

export default function PixelLabPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)

  const [challenge, setChallenge] = useState<PixelChallenge>(FIRST)
  const [html, setHtml] = useState(FIRST.starterHtml)
  const [css, setCss] = useState(FIRST.starterCss)
  const [lang, setLang] = useState<PixelLang>('css')

  const [result, setResult] = useState<ScoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [tiersByChallenge, setTiersByChallenge] = useState<TiersByChallenge>({})

  const settings = usePixelSettings()

  // The board is the home, and it opens on landing — unless the learner has said
  // otherwise. Read once, not reactively: flipping the setting mid-session
  // should change the *next* visit, not throw the map over the work you are
  // doing right now.
  const [mapOpen, setMapOpen] = useState(() => getSettings().mapOnLand)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [justOpened, setJustOpened] = useState<string[]>([])
  const [progressLoaded, setProgressLoaded] = useState(false)

  const source = useMemo<FrameSource>(() => ({ html, css }), [html, css])
  const states = useMemo(() => unlockStates(tiersByChallenge), [tiersByChallenge])
  const nextId = useMemo(() => nextChallengeId(tiersByChallenge), [tiersByChallenge])

  useEffect(() => {
    preloadSounds()
  }, [])

  const loadProgress = useCallback(async (): Promise<TiersByChallenge> => {
    const res = await fetch('/api/labs/pixel-lab/challenges/progress')
    // A guest gets a 401 here, which is not an error — it is a learner who has
    // done nothing yet, and unlockStates({}) already says "only the first one".
    if (!res.ok) {
      setProgressLoaded(true)
      return {}
    }
    const data = await res.json()
    const tiers: TiersByChallenge = data.tiersByChallenge ?? {}
    setTiersByChallenge(tiers)
    setProgressLoaded(true)
    return tiers
  }, [])

  /**
   * The board must not open before we know what is on it.
   *
   * Opening at mount with an empty ledger shows a learner who has cleared seven
   * challenges a brand-new run with everything locked, for as long as the fetch
   * takes — and then the road has to animate from nothing to the truth, which is
   * a correction dressed as a celebration. Waiting costs a few hundred
   * milliseconds and means the first thing they see is true.
   */
  const boardReady = signedIn ? progressLoaded : !sessionPending

  useEffect(() => {
    if (!signedIn) return
    /* eslint-disable react-hooks/set-state-in-effect */
    void loadProgress()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadProgress, signedIn])

  const celebrate = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } })
  }, [])

  const pick = useCallback((next: PixelChallenge) => {
    setChallenge(next)
    // Their unfinished work, if any — the starter is only for a challenge they
    // have never opened. Switching away and back used to reset you to scratch.
    const draft = loadDraft(next.id)
    setHtml(draft?.html ?? next.starterHtml)
    setCss(draft?.css ?? next.starterCss)
    setResult(null)
    setError(null)
    setLang('css')
    setMapOpen(false)
  }, [])

  // Restore the draft for whatever challenge we land on, once, on mount. `pick`
  // covers every later switch.
  useEffect(() => {
    const draft = loadDraft(FIRST.id)
    if (!draft) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setHtml(draft.html)
    setCss(draft.css)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  /**
   * Keep the draft, debounced.
   *
   * Every keystroke would be a synchronous localStorage write in an onChange
   * handler — cheap individually, but it is the one thing standing between the
   * learner and a dropped character while they type. A beat of idle is
   * indistinguishable to them and costs one write per pause.
   */
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(challenge.id, { html, css }), 400)
    return () => window.clearTimeout(t)
  }, [challenge.id, html, css])

  const restore = useCallback((s: Submission) => {
    setHtml(s.html)
    setCss(s.css)
    setResult(null)
    setError(null)
    toast.success('Loaded that attempt into the editor')
  }, [])

  const locked = states[challenge.id] === 'locked'

  async function score() {
    setPending(true)
    setError(null)
    // The panel earns its space the moment there is a score coming.
    setScoreOpen(true)

    try {
      // No capture, no image: the server renders this code itself. That is what
      // makes the number it sends back worth anything.
      const res = await fetch('/api/labs/pixel-lab/challenges/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, html, css }),
      })
      const body = await res.json()
      if (!res.ok) {
        const message = body.message ?? 'Could not score your build.'
        setError(message)
        toast.error(message)
        return
      }

      setResult(body as ScoreResult)
      const fresh: Tier[] = body.freshTiers ?? []
      const opened: string[] = body.opened ?? []

      if (fresh.length > 0) {
        playSound('score')
        void loadProgress()
        refreshXp()
        celebrate()
        toast.success(`${TIER_LABEL[fresh[fresh.length - 1]]} — +${body.xpGained} XP`)
      }

      if (opened.length > 0) {
        // Show them the board doing the thing they just earned. The delay lets
        // the score land first — two celebrations at once is one celebration.
        setJustOpened(opened)
        const milestone = crossedMilestone(opened)
        window.setTimeout(() => {
          setMapOpen(true)
          playSound('unlock', milestone ? 0.85 : 0.55)
          if (milestone) {
            const topic = PIXEL_TOPICS.find((t) => t.id === milestone)
            if (topic) toast.success(`${topic.title} unlocked`, { description: topic.blurb })
          }
        }, 900)
      }
    } catch {
      const message = 'Could not reach the server. Check your connection and try again.'
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-linear-to-br from-slate-50 via-white to-slate-100 transition-colors dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <LeaderboardSheet
        open={leaderboardOpen}
        onOpenChange={setLeaderboardOpen}
        endpoint="/api/labs/pixel-lab/leaderboard"
        emptyMessage="Nobody has matched a target yet this week. Get any build to 75% and you are on the board."
      />
      <ChallengeMap
        open={mapOpen && boardReady}
        onOpenChange={(v) => {
          setMapOpen(v)
          if (!v) setJustOpened([])
        }}
        tiers={tiersByChallenge}
        currentId={challenge.id}
        nextId={nextId}
        justOpened={justOpened}
        signedIn={signedIn}
        onPick={pick}
      />
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        challengeId={challenge.id}
        challengeTitle={challenge.title}
        onRestore={restore}
      />

      <header className="shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-pink-500 via-fuchsia-500 to-violet-600 shadow-md">
              <Grid2x2Check className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Pixel Lab</h1>
              <p className="text-xs leading-tight text-muted-foreground">Match the target. Pixel for pixel.</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Sound moved in here. A speaker button beside a settings menu that
                also owns sound is two switches for one preference. */}
            <SettingsMenu />
            <AnimatedThemeToggler />
            {signedIn && (
              <>
                <XpHint />
                <XpBadge />
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setMapOpen(true)} title="The run">
              <MapIcon className="h-4 w-4 text-pink-500 sm:mr-1" />
              <span className="hidden md:inline">Map</span>
            </Button>
            {signedIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                title="Your attempts at this challenge"
                className="hidden sm:flex"
              >
                <Clock className="h-4 w-4 text-sky-500 sm:mr-1" />
                <span className="hidden md:inline">Attempts</span>
              </Button>
            )}
            {signedIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeaderboardOpen(true)}
                title="Weekly leaderboard"
                className="hidden sm:flex"
              >
                <Trophy className="h-4 w-4 text-amber-500 sm:mr-1" />
                <span className="hidden md:inline">Ranks</span>
              </Button>
            )}
            {!signedIn && !sessionPending && (
              <Link
                href="/sign-in?next=/labs/pixel-lab"
                className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Sign in to score your builds and earn XP"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign in to score
              </Link>
            )}
            <Button
              variant="default"
              size="sm"
              className="bg-linear-to-r from-pink-500 to-red-500"
              onClick={score}
              disabled={pending || !signedIn || locked}
              title={locked ? 'Clear the challenge before this one first' : undefined}
            >
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
              {pending ? 'Scoring…' : 'Score'}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* `relative` so the mini-map has a corner to sit in — it is positioned
          against the work area, not the viewport, so it cannot cover the header
          or drift over the page on a short screen. */}
      <main className="relative min-h-0 flex-1 p-3">
        {/* Always on screen, unlike the board, which is a dialog and covers the
            editor. Hidden on small screens: there it would be sitting on top of
            the only column the learner has. */}
        {settings.miniMap && (
          <MiniMap
            tiers={tiersByChallenge}
            currentId={challenge.id}
            nextId={nextId}
            onOpen={() => setMapOpen(true)}
            className="hidden lg:block"
          />
        )}
        {/* Keyed by challenge, and the key is load-bearing twice over: it stops
            the text animating from the last brief into this one, and a fresh
            mount is what makes the scroll unroll itself again on every switch. */}
        <BriefScroll
          key={challenge.id}
          challengeTitle={challenge.title}
          brief={challenge.brief}
          isSpec={challenge.kind === 'brief'}
        />
        <ResizablePanelGroup orientation="horizontal" className="h-full gap-3">
          {/* Editor */}
          <ResizablePanel defaultSize={50} minSize={28} className="min-w-0">
            <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm">
              <div className="shrink-0 border-b bg-muted/50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    {challenge.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                    {challenge.canvas.width}×{challenge.canvas.height} · {challenge.estimate} min
                  </span>
                </div>
                {/* The brief itself is on the scroll at the bottom. It used to be
                    11px grey text here, which is where you put something you have
                    decided nobody will read. */}
              </div>

              <Tabs
                value={lang}
                onValueChange={(v) => setLang(v as PixelLang)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5">
                  <TabsList className="h-7">
                    <TabsTrigger value="html" className="text-xs">
                      HTML
                    </TabsTrigger>
                    <TabsTrigger value="css" className="text-xs">
                      CSS
                    </TabsTrigger>
                  </TabsList>
                  <span className="text-[11px] text-muted-foreground">
                    Emmet: type <code className="font-mono">div.box</code> and press Tab
                  </span>
                </div>
                {/* Both editors stay mounted: unmounting one would drop its undo history
                    every time the learner flips between markup and styles. Only the
                    visible one may hold focus, or they fight over the caret.
                    `!mapOpen` matters too — the board is a focus-trapping dialog, so
                    an editor grabbing the caret underneath it would both lose the
                    fight and break keyboard navigation of the map. */}
                <div className="min-h-0 flex-1">
                  <div className={cn('h-full', lang !== 'html' && 'hidden')}>
                    <PixelEditor
                      lang="html"
                      value={html}
                      onChange={setHtml}
                      focused={lang === 'html' && !mapOpen}
                    />
                  </div>
                  <div className={cn('h-full', lang !== 'css' && 'hidden')}>
                    <PixelEditor
                      lang="css"
                      value={css}
                      onChange={setCss}
                      focused={lang === 'css' && !mapOpen}
                    />
                  </div>
                </div>
              </Tabs>
            </section>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Compare + score */}
          <ResizablePanel defaultSize={50} minSize={28} className="min-w-0">
            {/* The score panel is not here until it has something to say. It used
                to sit open from the moment you arrived, spending a third of the
                column to tell you it had not scored anything yet — and the panel
                a learner actually wants at that moment is the one showing the
                target. It opens itself the instant you press Score. */}
            {scoreOpen ? (
              <ResizablePanelGroup orientation="vertical" className="h-full gap-3">
                <ResizablePanel defaultSize={64} minSize={30} className="min-h-0">
                  <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm">
                    <CompareStage source={source} canvas={challenge.canvas} targetPng={challenge.targetPng} />
                  </section>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={36} minSize={20} className="min-h-0">
                  <ScorePanel
                    result={result}
                    pending={pending}
                    error={error}
                    onHide={() => setScoreOpen(false)}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-3">
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm">
                  <CompareStage source={source} canvas={challenge.canvas} targetPng={challenge.targetPng} />
                </section>
                {/* Collapsed, it is a bar you can open — not a thing that vanished. */}
                <button
                  type="button"
                  onClick={() => setScoreOpen(true)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Target className="size-3.5" />
                  Score panel
                  <ChevronUp className="size-3" />
                </button>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  )
}
