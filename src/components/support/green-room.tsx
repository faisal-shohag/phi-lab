'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { SpeakingOrb } from '@/components/interview/speaking-orb'
import { MicCheck, type MicState } from '@/components/interview/mic-check'
import { CHARACTERS } from '@/lib/interview/topics'
import { supportCategoryById } from '@/lib/support/prompt'
import type { StartOptions } from '@/lib/support/use-support'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GreenRoomProps {
  category: string | null
  connecting: boolean
  onStart: (opts: StartOptions) => void
}

export function GreenRoom({ category, connecting, onStart }: GreenRoomProps) {
  const [characterId, setCharacterId] = useState(CHARACTERS[0].id)
  const [micState, setMicState] = useState<MicState>('unknown')

  const label = supportCategoryById(category ?? '')?.label ?? 'Support session'
  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]
  const canStart = micState === 'granted' && !connecting

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{label}</Badge>
          <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> A spot is ready
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">Green room</span>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <SpeakingOrb level={0.04} speaker="idle" className="absolute inset-0" />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Your supporter is <span className="font-semibold text-foreground">{character.name}</span> — {character.description.toLowerCase()}.
            You’ll talk by voice; you can share your screen anytime during the call.
          </p>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Choose your supporter’s voice</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {CHARACTERS.map((c) => {
              const selected = c.id === characterId
              return (
                <button
                  key={c.id}
                  onClick={() => setCharacterId(c.id)}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all duration-150',
                    selected ? 'border-foreground bg-accent shadow-sm' : 'border-border bg-card hover:border-foreground/30 hover:bg-accent',
                  )}
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white shadow', c.gradient)}>
                    {c.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-sm font-semibold leading-tight">
                      {c.name}
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">{c.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Check your microphone</h2>
          <MicCheck autoStart onStateChange={setMicState} />
        </section>

        <div className="mt-8">
          <Button
            size="lg"
            className="h-11 w-full text-base bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500"
            disabled={!canStart}
            onClick={() => onStart({ characterId })}
          >
            {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
            {connecting ? 'Connecting…' : micState === 'granted' ? 'Start the session' : 'Allow mic to start'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
