import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { SupportLab } from '@/components/support/support-lab'

export const metadata: Metadata = {
  title: 'Support Session',
  description: 'Talk live with a supportive AI about a coding problem, something on your mind, or where to go next.',
}

export default async function SupportLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/support')

  return <SupportLab userName={user.name} />
}
