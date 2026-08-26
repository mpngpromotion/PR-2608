'use client'

import { AnimatePresence, motion } from 'motion/react'
import PinchIcon from '@/svg/pinch.svg'

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
          className='pointer-events-none absolute top-1/2 -translate-y-1/2 left-1/2 z-20 -translate-x-1/2'
        >
          <PinchIcon className='w-16 h-16 text-black/50 animate-pinchMotion' />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
