'use client'

import { useEffect, useRef, useState } from 'react'

// 인트로 모션(스크롤/핀치로 확대·축소되는 상호작용)을 처음 접속한 사용자에게 알려주는 시간(ms).
const INTRO_HINT_DURATION = 3000

// 글자가 흩어졌다가(0) 모이는(1) 진행도를 스크롤/핀치 입력으로 관리하는 훅.
export function useGatherProgress() {
  const [progress, setProgress] = useState(0)
  const [showIntroHint, setShowIntroHint] = useState(true)
  const pinchDist = useRef<number | null>(null)

  // 몇 초 뒤 자동으로 사라지고, 사용자가 실제로 조작을 시작하면 그 즉시 사라진다.
  useEffect(() => {
    const timer = setTimeout(() => setShowIntroHint(false), INTRO_HINT_DURATION)
    return () => clearTimeout(timer)
  }, [])

  const advance = (delta: number) => {
    setShowIntroHint(false)
    setProgress((p) => Math.min(1, Math.max(0, p + delta)))
  }

  // PC: 스크롤/트랙패드 = wheel. 모바일: 두 손가락 핀치 거리 변화 = zoom.
  const handleWheel = (e: React.WheelEvent) => advance(e.deltaY * 0.0015)

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return
    const a = e.touches[0]
    const b = e.touches[1]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (pinchDist.current != null) advance((dist - pinchDist.current) * 0.003)
    pinchDist.current = dist
  }

  const handleTouchEnd = () => {
    pinchDist.current = null
  }

  const isGrouped = progress >= 1

  return { progress, isGrouped, showIntroHint, handleWheel, handleTouchMove, handleTouchEnd }
}
