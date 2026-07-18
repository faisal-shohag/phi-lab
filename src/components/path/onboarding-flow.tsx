'use client'

// The Day-0 onboarding: three questions, then the reveal. Deliberately light —
// goal + pace seed the PathProfile (which drives route + ETA), and the experience
// answer only tailors the closing copy. We never bank mastery from a self-report:
// skipping ahead is earned by proving it on the map (the jump-forward gate), not
// by claiming it here. That keeps the "a step is done only when a lab recorded it"
// rule intact from the very first screen.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Compass, Layout, Layers, Briefcase, Sparkles } from 'lucide-react'
import { PATH_GOALS, type PathGoal } from '@/lib/path/goals'
import { cn } from '@/lib/utils'

const GOAL_ICON: Record<PathGoal, typeof Layout> = {
  FRONTEND: Layout,
  FULLSTACK: Layers,
  INTERVIEW_PREP: Briefcase,
}

const HOURS = [3, 6, 10, 20]

const EXPERIENCE = [
  { id: 'new', label: 'Brand new', blurb: 'Never written code. The map starts fresh.' },
  { id: 'some', label: 'Some basics', blurb: 'Dabbled a bit — a tutorial or two.' },
  { id: 'built', label: 'Built things', blurb: 'Shipped projects. Expect to skip ahead fast.' },
] as const

type Experience = (typeof EXPERIENCE)[number]['id']

export function OnboardingFlow({ userName }: { userName: string }) {
  const router = useRouter()
  const first = userName.split(' ')[0]

  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<PathGoal | null>(null)
  const [hours, setHours] = useState<number | null>(null)
  const [experience, setExperience] = useState<Experience | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish() {
    if (!goal || !hours) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/path/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'onboard', goal, weeklyHours: hours }),
      })
      if (!res.ok) throw new Error('save failed')
      // The reveal: the map now knows the goal + pace and paints the route.
      router.push('/path')
      router.refresh()
    } catch {
      setError('Could not save that — check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* progress dots */}
      <div className="flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-8 bg-amber-500' : i < step ? 'w-8 bg-amber-500/40' : 'w-4 bg-muted')}
          />
        ))}
      </div>

      {step === 0 && (
        <Panel
          icon={Compass}
          eyebrow="Question 1 of 3"
          title={`Where are you headed, ${first}?`}
          subtitle="Pick a destination. You can change it any time — same map, new route."
        >
          <div className="grid gap-3">
            {PATH_GOALS.map((g) => {
              const Icon = GOAL_ICON[g.id]
              return (
                <button
                  key={g.id}
                  onClick={() => { setGoal(g.id); setStep(1) }}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-amber-400 hover:bg-amber-500/5',
                    goal === g.id && 'border-amber-500 bg-amber-500/10',
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <div className="font-bold">{g.label}</div>
                    <div className="text-sm text-muted-foreground">{g.blurb}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </Panel>
      )}

      {step === 1 && (
        <Panel
          icon={Sparkles}
          eyebrow="Question 2 of 3"
          title="How much time can you give it?"
          subtitle="Hours per week. This sets the date on your route — and honest beats optimistic."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => { setHours(h); setStep(2) }}
                className={cn(
                  'rounded-xl border p-4 text-center transition hover:border-amber-400 hover:bg-amber-500/5',
                  hours === h && 'border-amber-500 bg-amber-500/10',
                )}
              >
                <div className="text-2xl font-black">{h}</div>
                <div className="text-xs text-muted-foreground">hrs / week</div>
              </button>
            ))}
          </div>
          <BackLink onClick={() => setStep(0)} />
        </Panel>
      )}

      {step === 2 && (
        <Panel
          icon={Sparkles}
          eyebrow="Question 3 of 3"
          title="Have you written code before?"
          subtitle="Sets your expectations. On the map you'll prove what you know to skip ahead — nothing is assumed."
        >
          <div className="grid gap-3">
            {EXPERIENCE.map((e) => (
              <button
                key={e.id}
                onClick={() => setExperience(e.id)}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-4 text-left transition hover:border-amber-400 hover:bg-amber-500/5',
                  experience === e.id && 'border-amber-500 bg-amber-500/10',
                )}
              >
                <div>
                  <div className="font-bold">{e.label}</div>
                  <div className="text-sm text-muted-foreground">{e.blurb}</div>
                </div>
              </button>
            ))}
          </div>

          {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

          <button
            onClick={finish}
            disabled={!experience || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-4 py-3 font-bold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Reveal my path <ArrowRight className="h-4 w-4" /></>}
          </button>
          <BackLink onClick={() => setStep(1)} />
        </Panel>
      )}
    </div>
  )
}

function Panel({
  icon: Icon, eyebrow, title, subtitle, children,
}: {
  icon: typeof Compass
  eyebrow: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          <Icon className="h-3.5 w-3.5" /> {eyebrow}
        </div>
        <h2 className="mt-2 text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground">
      ← Back
    </button>
  )
}
