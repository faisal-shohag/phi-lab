'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { SocialButtons } from './social-buttons'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'sign-in' | 'sign-up'

/** Only allow same-origin relative redirects to avoid open-redirect abuse. */
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/labs/interview'
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const isSignUp = mode === 'sign-up'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = isSignUp
        ? await authClient.signUp.email({ name: name.trim() || email.split('@')[0], email, password })
        : await authClient.signIn.email({ email, password })
      if (res.error) {
        setError(res.error.message ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      router.push(redirect)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const otherHref = `/${isSignUp ? 'sign-in' : 'sign-up'}}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      {/* Mobile-only logo (brand panel is hidden on small screens) */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <Logo className="h-10 w-10" />
        <div>
          <div className="text-sm font-bold leading-tight">Phi Lab</div>
          <div className="text-[11px] leading-tight text-muted-foreground">Programming Hero Instructor Lab</div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isSignUp ? 'Start practising with the AI interview lab — free.' : 'Sign in to continue to Phi Lab.'}
        </p>
      </div>

      {/* Social */}
      <SocialButtons callbackURL={redirect} />

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or continue with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="h-11"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {!isSignUp && (
              <span className="text-xs text-muted-foreground">Min. 8 characters</span>
            )}
          </div>
          <Input
            id="password"
            type="password"
            className="h-11"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-[0.95rem]" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <Link href={otherHref} className="font-semibold text-foreground underline-offset-4 hover:underline">
          {isSignUp ? 'Sign in' : 'Sign up'}
        </Link>
      </p>

      {isSignUp && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By creating an account you agree to practise, learn, and level up. 🚀
        </p>
      )}
    </motion.div>
  )
}
