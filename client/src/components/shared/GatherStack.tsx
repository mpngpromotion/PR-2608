'use client'

import { motion } from 'motion/react'
import { ReactNode } from 'react'

export interface GatherStackTransform {
  x: number
  y: number
  rotate: number
  scale: number
}

export interface GatherStackItem {
  id: string
  node: ReactNode
  /** starting, scattered position/rotation (in px / deg, relative to center) */
  scatter: GatherStackTransform
}

interface GatherStackProps {
  items: GatherStackItem[]
  /** 0 = fully scattered, 1 = fully grouped at center */
  progress: number
  /** px offset applied per stacking index once grouped, for a "stacked cards" feel */
  stackOffset?: number
  className?: string
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

// TODO(user): 실제 최종 모인 위치 값은 여기서 index 기반 stackOffset 대신 직접 좌표로 조정 가능
export function GatherStack({ items, progress, stackOffset = 6, className }: GatherStackProps) {
  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {items.map((item, index) => {
        const grouped: GatherStackTransform = {
          x: index * stackOffset,
          y: index * stackOffset,
          rotate: 0,
          scale: 1,
        }

        const x = lerp(item.scatter.x, grouped.x, progress)
        const y = lerp(item.scatter.y, grouped.y, progress)
        const rotate = lerp(item.scatter.rotate, grouped.rotate, progress)
        const scale = lerp(item.scatter.scale, grouped.scale, progress)

        return (
          <motion.div
            key={item.id}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              zIndex: index,
            }}
            animate={{
              x: `calc(-50% + ${x}px)`,
              y: `calc(-50% + ${y}px)`,
              rotate,
              scale,
            }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            {item.node}
          </motion.div>
        )
      })}
    </div>
  )
}
