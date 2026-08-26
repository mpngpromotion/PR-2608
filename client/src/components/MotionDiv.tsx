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
        style={{ pointerEvents: isDone ? 'auto' : 'none' }}
        initial={false}
        animate={{ opacity: isDone ? 1 : 0 }}
        transition={{ duration: 0.4, delay: isDone ? 0.35 : 0, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </>
  )
}
