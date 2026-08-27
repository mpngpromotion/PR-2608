'use client'

import { motion } from 'motion/react'
import classNames from 'classnames'

interface FadeInViewProps {
  children: React.ReactNode
  className?: string
  /** 여러 요소를 순서대로 살짝 어긋나게 띄우고 싶을 때(초). */
  delay?: number
  /** 얼마나 아래에서 올라오며 나타날지(px). 0이면 제자리에서 페이드만 된다. */
  y?: number
}

// 페이지 접속 시 요소가 뷰포트에 들어오면(대부분 처음부터 화면 안이라 곧바로) 자연스럽게
// 페이드인되도록 감싸는 래퍼. viewport.once라 한 번 나타난 뒤엔 다시 사라지지 않는다.
export function FadeInView({ children, className, delay = 0, y = 12 }: FadeInViewProps) {
  return (
    <motion.div
      className={classNames(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
