// Displays the career/profile info (goal, skills, resume, social links). Used on
// both the owner's dashboard and the public /u/[id] page. Renders only the
// sections that have data; on the owner's empty profile it nudges toward editing.
import { Target, FileText, GitBranch, Briefcase, Globe } from 'lucide-react'
import type { ProfileInfo } from '@/lib/profile/shared'
import { prettyUrl } from '@/lib/profile/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditProfileDialog } from './edit-profile-dialog'

interface CareerCardProps {
  info: ProfileInfo
  isOwner?: boolean
}

export function CareerCard({ info, isOwner }: CareerCardProps) {
  const links = [
    { url: info.resumeUrl, label: 'Resume / CV', Icon: FileText },
    { url: info.githubUrl, label: 'GitHub', Icon: GitBranch },
    { url: info.linkedinUrl, label: 'LinkedIn', Icon: Briefcase },
    { url: info.websiteUrl, label: 'Website', Icon: Globe },
  ].filter((l) => !!l.url) as { url: string; label: string; Icon: typeof FileText }[]

  const hasContent = !!info.goal || info.skills.length > 0 || links.length > 0

  if (!hasContent) {
    if (!isOwner) return null
    return (
      <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">Add your goal, skills and links to make your profile stand out.</p>
        <EditProfileDialog info={info}>
          <Button size="sm" className="mt-3">Complete your profile</Button>
        </EditProfileDialog>
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
      {info.goal && (
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="size-3.5" /> Career goal
          </h3>
          <p className="text-sm font-medium">{info.goal}</p>
        </div>
      )}

      {info.skills.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {info.skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-sm">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Links</h3>
          <div className="flex flex-wrap gap-2">
            {links.map(({ url, label, Icon }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Icon className="size-4" />
                {label}
                <span className="hidden text-xs text-muted-foreground sm:inline">{prettyUrl(url)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
