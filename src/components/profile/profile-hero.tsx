// Premium profile hero: gradient banner, big avatar, name/headline/location,
// member-since, a level chip, and (owner-only) Edit + Share actions. Server
// component — the interactive bits (EditProfileDialog, ShareButton) are client
// components rendered as children.
import { MapPin, CalendarDays, Pencil } from 'lucide-react'
import type { ProfileInfo } from '@/lib/profile/shared'
import { initials, memberSince } from '@/lib/profile/format'
import { Button } from '@/components/ui/button'
import { EditProfileDialog } from './edit-profile-dialog'
import { ShareButton } from './share-button'
import type { ProfileCardData } from '@/lib/profile/draw-profile-card'

interface ProfileHeroProps {
  name: string
  email?: string | null
  image?: string | null
  createdAt: Date
  level: number
  title: string
  info: ProfileInfo
  /** When set, renders owner controls (Edit / Share). */
  owner?: { path: string; card: ProfileCardData }
}

export function ProfileHero({ name, email, image, createdAt, level, title, info, owner }: ProfileHeroProps) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm">
      {/* Gradient banner */}
      <div className="h-24 bg-linear-to-r from-amber-400 via-fuchsia-500 to-violet-600 sm:h-28" />

      <div className="px-5 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Avatar overlapping the banner */}
          <div className="-mt-12 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 text-2xl font-bold text-white shadow-md">
            {image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={image} alt={name} className="size-full object-cover" />
              : <span>{initials(name, email)}</span>}
          </div>

          <div className="flex-1 sm:pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold leading-tight">{name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-amber-400/15 to-fuchsia-500/15 px-2 py-0.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">
                Lvl {level} · {title}
              </span>
            </div>
            {info.headline && <p className="mt-0.5 text-sm text-muted-foreground">{info.headline}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {info.location && (
                <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{info.location}</span>
              )}
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />Member since {memberSince(createdAt)}</span>
            </div>
          </div>

          {owner && (
            <div className="flex shrink-0 items-center gap-2">
              <ShareButton path={owner.path} isPublic={info.profilePublic} card={owner.card} />
              <EditProfileDialog info={info}>
                <Button size="sm">
                  <Pencil className="size-4" />
                  Edit profile
                </Button>
              </EditProfileDialog>
            </div>
          )}
        </div>

        {info.bio && <p className="mt-4 text-sm leading-relaxed text-foreground/90">{info.bio}</p>}
      </div>
    </div>
  )
}
