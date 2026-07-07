'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { SpeakingOrb } from './speaking-orb'
import { MicCheck, type MicState } from './mic-check'
import {
  CHARACTERS, LANGUAGES, topicById, levelById,
  type LanguageId, type LevelId,
} from '@/lib/interview/topics'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface StartOptions {
  language: LanguageId
  characterId: string
}

interface GreenRoomProps {
  topic: string | null
  level: LevelId | null
  connecting: boolean
  onStart: (opts: StartOptions) => void
  onBack: () => void
}

export function GreenRoom({ topic, level, connecting, onStart, onBack }: GreenRoomProps) {
  const [characterId, setCharacterId] = useState(CHARACTERS[0].id)
  const [language, setLanguage] = useState<LanguageId>('en')
  const [micState, setMicState] = useState<MicState>('unknown')

  const topicLabel = topicById(topic ?? '')?.label ?? topic ?? ''
  const levelLabel = levelById(level ?? 'medium')?.label ?? level ?? ''
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
          <Badge variant="secondary">{topicLabel}</Badge>
          <Badge variant="outline">{levelLabel}</Badge>
          <span className="ml-auto text-xs text-muted-foreground">Green room</span>
        </div>

        {/* Orb preview */}
        <div className="mt-6 flex flex-col items-center">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <SpeakingOrb level={0.04} speaker="idle" className="absolute inset-0" />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            You&apos;ll be interviewed by <span className="font-semibold text-foreground">{character.name}</span> — {character.description.toLowerCase()}.
          </p>
        </div>

        {/* Character picker */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Choose your interviewer</h2>
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

        {/* Language segmented control */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Interview language</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {LANGUAGES.map((l) => {
              const selected = l.id === language
              return (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id)}
                  className={cn(
                    'rounded-xl border-2 p-3 text-center text-sm font-semibold transition-all duration-150',
                    selected ? 'border-foreground bg-foreground text-background shadow-md' : 'border-border bg-card hover:border-foreground/30 hover:bg-accent',
                  )}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Mic check */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Check your microphone</h2>
          <MicCheck autoStart onStateChange={setMicState} />
        </section>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <Button variant="outline" onClick={onBack} disabled={connecting}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            size="lg"
            className="h-11 flex-1 text-base"
            disabled={!canStart}
            onClick={() => onStart({ language, characterId })}
          >
            {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
            {connecting ? 'Connecting…' : micState === 'granted' ? 'Start interview' : 'Allow mic to start'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
