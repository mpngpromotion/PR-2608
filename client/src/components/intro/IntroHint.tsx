'use client'

import { AnimatePresence, motion } from 'motion/react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

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
          <DotLottieReact src='/lottie/scrolldown.lottie' loop autoplay className='w-14 h-14' />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
