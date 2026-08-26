'use client'

import { useEffect, useRef, useState } from 'react'

// 인트로 모션(스크롤/핀치로 확대·축소되는 상호작용)을 처음 접속한 사용자에게 알려주는 시간(ms).
const INTRO_HINT_DURATION = 3000
// true로 바꾸면 INTRO_HINT_DURATION 뒤 자동으로 사라지는 타이머가 다시 켜진다.
const INTRO_HINT_AUTO_HIDE = false

// isGrouped가 true(다 모임)로 래치된 뒤, progress가 이 밑으로 내려가야 다시 풀린다.
// 핀치 막판 손떨림으로 progress가 1에서 아주 살짝(예: 0.999) 내려갔다 올라오는 프레임이 섞이는데,
// 임계값을 1로 그대로 두면 그 순간마다 isGrouped가 false→true로 튀면서 페이드인이 한 번 더 깜빡였다.
const GATHER_RELEASE_THRESHOLD = 0.98

// 글자가 흩어졌다가(0) 모이는(1) 진행도를 스크롤/핀치 입력으로 관리하는 훅.
export function useGatherProgress() {
  const [progress, setProgress] = useState(0)
  const [isGrouped, setIsGrouped] = useState(false)
  const [showIntroHint, setShowIntroHint] = useState(true)
  const pinchDist = useRef<number | null>(null)
  // progress/isGrouped state는 리렌더를 거쳐야 갱신되므로, 같은 프레임 안에서 연달아 들어오는
  // touchmove 이벤트가 그 사이의 값을 못 보고 갱신 전 값을 기준으로 판단해 깜빡임이 생겼다.
  // 리렌더를 기다리지 않고 최신 값을 즉시 읽을 수 있도록 ref에도 동기적으로 값을 함께 들고 있는다.
  const progressRef = useRef(0)
  const isGroupedRef = useRef(false)

  // 사용자가 실제로 조작을 시작하면 즉시 사라진다. INTRO_HINT_AUTO_HIDE가 true면 몇 초 뒤 자동으로도 사라진다.
  useEffect(() => {
    if (!INTRO_HINT_AUTO_HIDE) return
    const timer = setTimeout(() => setShowIntroHint(false), INTRO_HINT_DURATION)
    return () => clearTimeout(timer)
  }, [])

  const advance = (delta: number) => {
    setShowIntroHint(false)
    const next = Math.min(1, Math.max(0, progressRef.current + delta))
    progressRef.current = next
    setProgress(next)

    if (next >= 1) isGroupedRef.current = true
    else if (next < GATHER_RELEASE_THRESHOLD) isGroupedRef.current = false
    setIsGrouped(isGroupedRef.current)
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

  return { progress, isGrouped, showIntroHint, handleWheel, handleTouchMove, handleTouchEnd }
}
