import { notFound, redirect } from 'next/navigation'
import { getHiveUser, isMentor } from '@/lib/hive/roles'
import { loadPostDetail } from '@/lib/hive/detail'
import { PostThread } from '@/components/hive/post-thread'

export default async function HivePostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getHiveUser()
  if (!user) redirect('/sign-in?redirect=/hive')

  const { id } = await params
  const post = await loadPostDetail(id, user.id, isMentor(user))
  if (!post) notFound()

  return <PostThread initial={post} viewer={{ id: user.id, role: user.role }} />
}
