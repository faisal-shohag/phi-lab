'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { GripVertical, Minimize2 } from 'lucide-react'

interface Geometry {
  x: number
  y: number
  w: number
  h: number
}

const MIN_W = 320
const MIN_H = 240

// A dependency-free floating window: drag it by the header (framer-motion drag
// controls, so only the header initiates a move) and resize from the bottom-right
// corner (pointer events). Geometry is session-only — it resets on reload.
export function FloatingWindow({
  title,
  onDock,
  children,
  initial = { x: 140, y: 96, w: 580, h: 460 },
}: {
  title: string
  onDock: () => void
  children: ReactNode
  initial?: Geometry
}) {
  const controls = useDragControls()
  const [size, setSize] = useState({ w: initial.w, h: initial.h })

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Apply pointer deltas via a functional update so we never read stale size.
    let lastX = e.clientX
    let lastY = e.clientY

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX
      const dy = ev.clientY - lastY
      lastX = ev.clientX
      lastY = ev.clientY
      setSize((s) => ({ w: Math.max(MIN_W, s.w + dx), h: Math.max(MIN_H, s.h + dy) }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      initial={{ x: initial.x, y: initial.y }}
      style={{ width: size.w, height: size.h }}
      className="fixed left-0 top-0 z-50 flex flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-2xl"
    >
      <div
        onPointerDown={(e) => controls.start(e)}
        className="flex shrink-0 cursor-grab items-center gap-2 border-b bg-muted/70 px-3 py-2 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
        <button
          onClick={onDock}
          title="Dock the panel back in place"
          className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Dock
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      <div
        onPointerDown={startResize}
        title="Drag to resize"
        className="absolute bottom-0 right-0 z-10 flex h-4 w-4 cursor-nwse-resize items-end justify-end"
      >
        <span className="m-0.5 h-2.5 w-2.5 rounded-sm border-b-2 border-r-2 border-muted-foreground/50" />
      </div>
    </motion.div>
  )
}
