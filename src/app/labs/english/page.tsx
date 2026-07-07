import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { EnglishLab } from '@/components/english/english-lab'

export default async function EnglishLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/english')

  return <EnglishLab userName={user.name} />
}
