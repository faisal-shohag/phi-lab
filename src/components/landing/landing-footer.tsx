import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <div className="text-sm">
            <span className="font-semibold">Phi Lab</span>
            <span className="ml-2 text-muted-foreground">A Programming Hero Instructor Lab project</span>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/labs/js-motion" className="hover:text-foreground">Js Motion Lab</Link>
          <Link href="/labs/interview" className="hover:text-foreground">Interview Lab</Link>
          <span>© {year} Phi Lab</span>
        </div>
      </div>
    </footer>
  )
}
