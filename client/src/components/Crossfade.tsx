'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ReactNode } from 'react'

// activeKey가 바뀌면 이전 children은 페이드 아웃되고 새 children이 페이드 인된다.
export function Crossfade({
  activeKey,
  children,
  duration = 0.2,
}: {
  activeKey: string
  children: ReactNode
  duration?: number
}) {
  return (
    <AnimatePresence mode='wait' initial={false}>
      <motion.div
        key={activeKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
