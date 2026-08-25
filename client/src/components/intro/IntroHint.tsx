'use client'

import { AnimatePresence, motion } from 'motion/react'

// 인트로 진입 시 잠깐 보여주는 조작 안내 툴팁.
export function IntroHint({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key='intro-hint'
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className='pointer-events-none absolute top-[8%] left-1/2 z-20 -translate-x-1/2 text-nowrap rounded-full bg-black/70 px-4 py-2 text-xs text-white'
        >
          스크롤하거나 두 손가락으로 확대/축소해보세요
        </motion.div>
      )}
    </AnimatePresence>
  )
}
