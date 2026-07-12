'use client'

import type { PathModule } from '@/lib/path/curriculum'
import type { NodeProgress } from '@/lib/path/types'
import { cn } from '@/lib/utils'
import { NodeCard } from './node-card'

interface Props {
  module: PathModule
  nodes: NodeProgress[]
  activeNodeId: string | null
}

export function ModuleTrack({ module, nodes, activeNodeId }: Props) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const mastered = module.nodes.filter((n) => byId.get(n.id)?.state === 'mastered').length
  const locked = module.nodes.every((n) => byId.get(n.id)?.state === 'locked')

  return (
    <section className={cn('transition', locked && 'opacity-60')}>
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('h-8 w-1.5 rounded-full bg-linear-to-b', module.tint)} />
        <div className="flex-1">
          <h3 className="text-sm font-black">{module.title}</h3>
          <p className="text-xs text-muted-foreground">{module.subtitle}</p>
        </div>
        <span className="text-xs font-mono font-bold text-muted-foreground">
          {mastered}/{module.nodes.length}
        </span>
      </div>

      <div className="space-y-2 border-l-2 border-dashed pl-4 ml-[7px]">
        {module.nodes.map((node) => {
          const p = byId.get(node.id)
          if (!p) return null
          return <NodeCard key={node.id} node={node} progress={p} active={node.id === activeNodeId} />
        })}
      </div>
    </section>
  )
}
