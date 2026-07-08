'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Heart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FeedbackScreenProps {
  sent: boolean
  onSubmit: (rating: number, comment: string) => Promise<void>
  onDone: () => void
}

const RATING_WORDS = ['', 'Not helpful', 'Could be better', 'Okay', 'Helpful', 'Really helpful']

export function FeedbackScreen({ sent, onSubmit, onDone }: FeedbackScreenProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const shown = hover || rating

  async function submit() {
    if (rating < 1 || submitting) return
    setSubmitting(true)
    await onSubmit(rating, comment)
    setSubmitting(false)
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full rounded-3xl border-2 border-border bg-card p-8 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-lg">
            <Heart className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Thanks for talking with us</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We hope it helped. Come back anytime you want to think something through.
          </p>
          <Button className="mt-6 bg-linear-to-r from-rose-500 to-pink-600" onClick={onDone}>
            Start another session
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-3xl border-2 border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-bold">How was your session?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your feedback helps us make support better.</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="transition-transform hover:scale-110"
              title={RATING_WORDS[n]}
            >
              <Star
                className={cn(
                  'h-9 w-9',
                  n <= shown ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
                )}
              />
            </button>
          ))}
        </div>
        <p className="mt-2 h-5 text-sm font-medium text-muted-foreground">{RATING_WORDS[shown] ?? ''}</p>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Anything you’d like to add? (optional)"
          className="mt-4 w-full resize-none rounded-xl border-2 border-border bg-card p-3 text-left text-sm outline-none transition-colors focus:border-foreground/40"
        />

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="ghost" className="text-muted-foreground" onClick={onDone} disabled={submitting}>
            Skip
          </Button>
          <Button className="bg-linear-to-r from-rose-500 to-pink-600" disabled={rating < 1 || submitting} onClick={submit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit feedback
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
