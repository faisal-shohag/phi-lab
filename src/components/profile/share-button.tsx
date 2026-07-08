'use client'

// Share controls for the owner's profile: copy the public link and download a
// PNG card. If the profile isn't public yet, copying/downloading still works but
// we warn that the link won't be viewable until they flip the public switch.
import { useState } from 'react'
import { Check, Download, Link2, Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { downloadProfileCard, type ProfileCardData } from '@/lib/profile/draw-profile-card'

interface ShareButtonProps {
  /** Absolute or root-relative public profile path, e.g. /u/<id>. */
  path: string
  isPublic: boolean
  card: ProfileCardData
}

export function ShareButton({ path, isPublic, card }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [drawing, setDrawing] = useState(false)

  function fullUrl() {
    if (typeof window === 'undefined') return path
    return new URL(path, window.location.origin).toString()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success(isPublic ? 'Link copied' : 'Link copied — turn on “Public profile” so others can view it.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  async function download() {
    setDrawing(true)
    try {
      await downloadProfileCard({ ...card, url: fullUrl() })
    } catch {
      toast.error('Could not generate the image.')
    } finally {
      setDrawing(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void copyLink() }}>
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copied ? 'Copied!' : 'Copy profile link'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void download() }} disabled={drawing}>
          {drawing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download card image
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
