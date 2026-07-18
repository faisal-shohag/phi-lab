'use client'

// The Path, rendered. A vertical module-by-module skill map, the daily quest,
// and the AI weekly report card.
//
// The map is authoritative on the server (getPathSnapshot syncs + banks), so
// this component's job is display + refetch: whenever the learner comes back
// from a lab (tab refocus / visibility regain), it re-pulls the snapshot so a
// step they just finished flips to done and a freshly-mastered node lights up
// without a manual reload.
import { useCallback, useEffect, useState } from 'react'
import { refreshXp } from '@/lib/gamification/use-xp'
import type { PathModule } from '@/lib/path/curriculum'
import type { PathSnapshot } from '@/lib/path/types'
import { PathHeader } from './path-header'
import { QuestCard } from './quest-card'
import { WeeklyCard } from './weekly-card'
import { ModuleTrack } from './module-track'

interface Props {
  initial: PathSnapshot
  modules: PathModule[]
  userName: string
}

export function PathView({ initial, modules, userName }: Props) {
  const [snap, setSnap] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)

  const refetch = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/path/snapshot')
      if (res.ok) {
        setSnap((await res.json()) as PathSnapshot)
        // The header XP pill lives in the shared store — keep it in sync when a
        // node banks its bonus.
        void refreshXp()
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Re-pull when the learner returns from a lab in another tab or refocuses.
  useEffect(() => {
    const onFocus = () => { void refetch() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refetch() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refetch])

  return (
    <div className="space-y-6">
      <PathHeader snap={snap} userName={userName} onRefresh={refetch} refreshing={refreshing} />

      <div className="grid gap-4 md:grid-cols-2">
        <QuestCard quest={snap.quest} />
        <WeeklyCard report={snap.report} onRefresh={refetch} />
      </div>

      <div className="space-y-8">
        {modules.map((m) => (
          <ModuleTrack key={m.id} module={m} nodes={snap.nodes} activeNodeId={snap.activeNodeId} onChanged={refetch} />
        ))}
      </div>
    </div>
  )
}
