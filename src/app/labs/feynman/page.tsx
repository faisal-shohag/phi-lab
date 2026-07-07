import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { FeynmanLab } from '@/components/feynman/feynman-lab'

export default async function FeynmanLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/feynman')

  return <FeynmanLab userName={user.name} />
}
