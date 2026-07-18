import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

const LABS = [
  { href: '/path', label: 'The Path' },
  { href: '/labs/js-motion', label: 'Js Motion Lab' },
  { href: '/labs/pixel-lab', label: 'Pixel Lab' },
  { href: '/labs/code-lab', label: 'Code Lab' },
  { href: '/labs/interview', label: 'Interview Lab' },
]

const MORE_LABS = [
  { href: '/labs/support', label: 'Support Session' },
  { href: '/labs/feynman', label: 'Feynman Lab' },
  { href: '/labs/english', label: 'English Lab' },
  { href: '/labs/quiz', label: 'Quiz Lab' },
]

const PLATFORM = [
  { href: '/hive', label: 'Hive' },
  { href: '/profile', label: 'Profile' },
  { href: '/#features', label: 'Features' },
  { href: '/#journey', label: 'How it works' },
]

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="h-8 w-8" />
              <span className="font-semibold">Phi Lab</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A hands-on platform that turns passive reading into active practice — from your
              first <span className="font-mono">console.log</span> to job-ready.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">A Programming Hero Instructor Lab project</p>
          </div>

          <FooterColumn title="Labs" links={LABS} />
          <FooterColumn title="More labs" links={MORE_LABS} />
          <FooterColumn title="Platform" links={PLATFORM} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {year} Phi Lab</span>
          <span className="font-mono text-xs">See it · Run it · Say it</span>
        </div>
      </div>
    </footer>
  )
}
