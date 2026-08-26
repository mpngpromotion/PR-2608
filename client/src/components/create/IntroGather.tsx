'use client'

import { useState } from 'react'

import { GatherStack, GatherStackItem } from '@/components/shared/GatherStack'
import { tweenProgress } from '@/components/shared/tween'

const GATHER_DURATION = 1400
const PLACEHOLDER_COUNT = 5

// 아직 사진을 고르기 전이라 실제 이미지 대신 빈 사각형(placeholder)들을 흩어놓는다.
const PLACEHOLDERS: GatherStackItem[] = Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => ({
  id: String(index),
  scatter: {
    x: (index % 2 === 0 ? -1 : 1) * (120 + index * 20),
    y: (index % 3 === 0 ? -1 : 1) * (100 + index * 16),
    rotate: (index % 2 === 0 ? -1 : 1) * 8,
    scale: 1,
  },
  node: <div className='h-24 w-24 border border-white/30' />,
}))

interface IntroGatherProps {
  onComplete: () => void
}

// 기획안 화면 1~2: 화면을 터치하면 흩어진 사각형들이 가운데로 모이고, 안내 문구가 진하게 바뀐다.
export function IntroGather({ onComplete }: IntroGatherProps) {
  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleTouch = () => {
    if (started) return
    setStarted(true)
    tweenProgress(GATHER_DURATION, setProgress, onComplete)
  }

  return (
    <button
      type='button'
      onClick={handleTouch}
      className='relative mx-auto flex aspect-9/16 w-full max-w-xs items-center justify-center overflow-hidden bg-black text-white'
    >
      <GatherStack items={PLACEHOLDERS} progress={progress} className='h-full w-full' />
      <p className={`absolute px-8 text-sm transition-opacity ${started ? 'opacity-100 font-bold' : 'opacity-40'}`}>
        이제, 여러분의 Layer를 쌓아보세요
      </p>
    </button>
  )
}
