import Image from 'next/image'
import { cn } from '@/lib/utils'

/** The Phi Lab gradient P/Φ monogram tile. Size it with height/width utilities. */
export function Logo({ className, alt = 'Phi Lab' }: { className?: string; alt?: string }) {
  return (
    <Image
      src="/phi-mark.svg"
      width={64}
      height={64}
      alt={alt}
      priority
      className={cn('h-8 w-8 drop-shadow-sm', className)}
    />
  )
}
