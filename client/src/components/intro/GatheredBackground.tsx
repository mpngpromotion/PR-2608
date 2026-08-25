'use client'

import { motion } from 'motion/react'

// 글자가 다 모이면 뒤에서 서서히 나타나는 앨범 자리 배경.
export function GatheredBackground({ isGrouped }: { isGrouped: boolean }) {
  return (
    <motion.div
      id='gathered-background'
      initial={false}
      animate={{
        backgroundColor: isGrouped ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)',
        boxShadow: isGrouped ? '0 0 20px rgba(0,0,0,0.2)' : '0 0 20px rgba(0,0,0,0)',
      }}
      // 글자들이 모이는 스프링 애니메이션이 끝난 뒤에야 배경/쉐도우가 서서히 나타나도록 지연시킨다.
      transition={{ duration: 0.4, delay: isGrouped ? 0.35 : 0, ease: 'easeOut' }}
      className='aspect-square h-auto w-(--album-size) shrink-0 '
    />
  )
}
