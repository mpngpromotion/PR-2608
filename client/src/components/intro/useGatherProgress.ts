'use client'

import { useEffect, useRef, useState } from 'react'

// 인트로 모션(스크롤/핀치로 확대·축소되는 상호작용)을 처음 접속한 사용자에게 알려주는 시간(ms).
const INTRO_HINT_DURATION = 3000
// true로 바꾸면 INTRO_HINT_DURATION 뒤 자동으로 사라지는 타이머가 다시 켜진다.
const INTRO_HINT_AUTO_HIDE = false

// 핀치 거리(px) 변화를 progress로 바꾸는 배율. 값을 올릴수록 같은 핀치 양으로 더 빨리
// 끝까지 모인다 — 아래 GATHER_RELEASE_THRESHOLD가 이 값을 기준으로 계산되니, 이 값을
// 바꾸면 임계값도 자동으로 같이 조정된다(따로 안 맞춰줘도 됨).
const TOUCH_SENSITIVITY = 0.006
const WHEEL_SENSITIVITY = 0.003

// isGrouped가 true(다 모임)로 래치된 뒤, progress가 이 밑으로 내려가야 다시 풀린다.
// 핀치 막판 손떨림으로 progress가 1에서 살짝 내려갔다 올라오는 프레임이 섞이는데, 임계값이
// 1에 너무 가까우면 그 정도 흔들림도 걸려서 isGrouped가 true→false→true로 한 프레임 튀고,
// MotionDiv들이 그 프레임만큼 opacity 0으로 꺼졌다 켜지면서 깜빡인다.
// 임계값을 progress 단위로 고정값(예: 0.85)으로 두면, 나중에 TOUCH_SENSITIVITY를 조정할 때마다
// "손떨림 몇 px까지 허용할지"가 같이 바뀌어버려서 또 이 버그가 재발한다(실제로 민감도를
// 올렸다가 재발했었다). 그래서 "핀치 거리 기준 몇 px까지의 흔들림을 허용할지"를 기준으로 두고,
// 거기에 현재 민감도를 곱해서 임계값을 역산한다 — 민감도가 바뀌어도 손떨림 허용 폭(px)은 그대로다.
const RELEASE_TOLERANCE_PX = 60
const GATHER_RELEASE_THRESHOLD = 1 - RELEASE_TOLERANCE_PX * TOUCH_SENSITIVITY

// 위 임계값을 어쩌다 순간적으로 넘나드는 프레임이 또 섞이더라도(예: 아주 강한 손떨림) 화면에
// 그 흔들림이 그대로 보이지 않도록, "풀림(false)"만 이 시간(ms)만큼 붙잡아둔다. 그 사이 다시
// true로 돌아오면 풀림 자체를 취소해서 아이콘이 꺼졌다 켜지는 깜빡임 없이 계속 true로 남는다.
// 반대로 "모임(true)"은 지연 없이 즉시 반영한다 — 다 모이는 순간은 최대한 즉각적이어야 한다.
const GATHER_RELEASE_DEBOUNCE_MS = 150

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
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(releaseTimer.current), [])

  // iOS Safari는 touch-action: none / user-scalable=no를 줘도 두 손가락 핀치에서만큼은 자체
  // 네이티브 확대(gesturestart/change/end라는 Safari 전용 이벤트로 동작)를 완전히 막지 못하는
  // 경우가 있다 — 우리 JS로 만든 가짜 확대(글자 모으기)와 Safari의 진짜 페이지 확대가 동시에
  // 일어나면서 화면이 깜빡이는 것처럼 보였을 가능성이 크다. 표준 touch 이벤트가 아니라 이
  // 전용 이벤트를 직접 막아야 한다(다른 브라우저엔 이 이벤트 자체가 없어서 해가 되지 않는다).
  useEffect(() => {
    const preventNativeGesture = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', preventNativeGesture)
    document.addEventListener('gesturechange', preventNativeGesture)
    document.addEventListener('gestureend', preventNativeGesture)
    return () => {
      document.removeEventListener('gesturestart', preventNativeGesture)
      document.removeEventListener('gesturechange', preventNativeGesture)
      document.removeEventListener('gestureend', preventNativeGesture)
    }
  }, [])

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

    if (next >= 1) {
      clearTimeout(releaseTimer.current)
      isGroupedRef.current = true
      setIsGrouped(true)
    } else if (next < GATHER_RELEASE_THRESHOLD && isGroupedRef.current && !releaseTimer.current) {
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = undefined
        isGroupedRef.current = false
        setIsGrouped(false)
      }, GATHER_RELEASE_DEBOUNCE_MS)
    }
  }

  // PC: 스크롤/트랙패드 = wheel. 모바일: 두 손가락 핀치 거리 변화 = zoom.
  const handleWheel = (e: React.WheelEvent) => advance(e.deltaY * WHEEL_SENSITIVITY)

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return
    const a = e.touches[0]
    const b = e.touches[1]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (pinchDist.current != null) advance((dist - pinchDist.current) * TOUCH_SENSITIVITY)
    pinchDist.current = dist
  }

  const handleTouchEnd = () => {
    pinchDist.current = null
  }

  return { progress, isGrouped, showIntroHint, handleWheel, handleTouchMove, handleTouchEnd }
}
