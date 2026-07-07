import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { InterviewLab } from '@/components/interview/interview-lab'

export default async function InterviewLabPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/interview')

  return <InterviewLab userName={user.name} />
}
