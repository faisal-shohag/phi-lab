import { HiveFeed } from '@/components/hive/hive-feed'

// Auth is enforced by the Hive layout; the feed fetches client-side.
export default function HivePage() {
  return <HiveFeed />
}
