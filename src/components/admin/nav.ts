// Nav definition for the admin shell. Kept data-only and separate from the
// sidebar component so the breadcrumb can resolve a title from a pathname
// without importing a client component, and so a future /mentor shell can reuse
// the same shape with a narrower list.
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Hexagon,
  FlaskConical,
  Code2,
  SlidersHorizontal,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description: string
}

export const ADMIN_NAV: NavItem[] = [
  {
    title: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Platform health at a glance',
  },
  {
    title: 'AI Usage',
    href: '/admin/ai-usage',
    icon: Sparkles,
    description: 'Tokens, latency and failures per feature',
  },
  {
    title: 'Labs',
    href: '/admin/labs',
    icon: FlaskConical,
    description: 'Session usage and what is running now',
  },
  {
    title: 'Code Lab',
    href: '/admin/code-lab',
    icon: Code2,
    description: 'Author problems and generate with AI',
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Roles, access and suspension',
  },
  {
    title: 'Hive',
    href: '/admin/hive',
    icon: Hexagon,
    description: 'Helpdesk resolution and hand-offs',
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: SlidersHorizontal,
    description: 'Feature flags, limits and round times',
  },
  {
    title: 'Audit Log',
    href: '/admin/audit',
    icon: ScrollText,
    description: 'Every privileged action, appended',
  },
]

/**
 * The nav entry a pathname belongs to. Longest matching href wins, so
 * /admin/ai-usage resolves to "AI Usage" rather than the "/admin" overview.
 */
export function navItemFor(pathname: string): NavItem | undefined {
  return [...ADMIN_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
}
