import { redirect } from 'next/navigation'
import { getHiveUser, isMentor } from '@/lib/hive/roles'
import { MentorQueue } from '@/components/hive/mentor-queue'
import { AnnouncementComposer } from '@/components/hive/announcement-composer'

export default async function MentorPage() {
  const user = await getHiveUser()
  if (!user) redirect('/sign-in?redirect=/hive/mentor')
  if (!isMentor(user)) redirect('/hive')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Mentor Queue</h1>
        <p className="text-sm text-muted-foreground">
          Posts the Hive AI couldn&apos;t resolve, longest-waiting first. Every row shows what the AI already tried.
        </p>
      </div>
      <AnnouncementComposer />
      <MentorQueue mentorId={user.id} />
    </div>
  )
}
