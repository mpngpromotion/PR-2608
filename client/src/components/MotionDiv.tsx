'use client'

import { motion } from 'motion/react'
import classNames from 'classnames'
import { commonTransition } from '@/theme/transition'

// 글자가 다 모이면(isGrouped) 페이드 인되는 링크/버튼.
export const MotionDiv = ({
  id,
  className,
  isDone,
  clickable = false,
  children,
}: {
  id?: string
  className?: string
  clickable?: boolean
  isDone: boolean
  children: React.ReactNode
}) => {
  return (
    <>
      <motion.div
        id={id}
        className={classNames(className, clickable && commonTransition)}
        // willChange: 아이콘(<img>) 안에 든 raster 이미지가 opacity 애니메이션 중에 모바일
        // Safari에서 매 프레임 리페인트되면서 깜빡이는 문제가 있었다 — 이 힌트를 주면 브라우저가
        // 미리 별도 GPU 레이어로 승격해둬서 opacity 변화가 리페인트 없이 합성(compositing)만으로
        // 처리된다. 텍스트는 원래 안 깜빡였지만(리페인트 비용이 작아서) 이 힌트를 줘도 해는 없다.
        style={{ pointerEvents: isDone ? 'auto' : 'none', willChange: 'opacity' }}
        initial={false}
        animate={{ opacity: isDone ? 1 : 0 }}
        transition={{ duration: 0.4, delay: isDone ? 0.35 : 0, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </>
  )
}
