'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// 인트로 모션(스크롤로 확대·축소되는 상호작용)을 처음 접속한 사용자에게 알려주는 시간(ms).
const INTRO_HINT_DURATION = 3000
// true로 바꾸면 INTRO_HINT_DURATION 뒤 자동으로 사라지는 타이머가 다시 켜진다.
const INTRO_HINT_AUTO_HIDE = false

// 터치 이동 거리(px) 변화를 progress로 바꾸는 배율. 값을 올릴수록 같은 스와이프 양으로 더 빨리
// 끝까지 모인다 — 아래 GATHER_RELEASE_THRESHOLD가 이 값을 기준으로 계산되니, 이 값을
// 바꾸면 임계값도 자동으로 같이 조정된다(따로 안 맞춰줘도 됨).
const TOUCH_SENSITIVITY = 0.006
const WHEEL_SENSITIVITY = 0.003

// isGrouped가 true(다 모임)로 래치된 뒤, progress가 이 밑으로 내려가야 다시 풀린다.
// 스와이프 막판 손떨림으로 progress가 1에서 살짝 내려갔다 올라오는 프레임이 섞이는데, 임계값이
// 1에 너무 가까우면 그 정도 흔들림도 걸려서 isGrouped가 true→false→true로 한 프레임 튀고,
// MotionDiv들이 그 프레임만큼 opacity 0으로 꺼졌다 켜지면서 깜빡인다.
// 임계값을 progress 단위로 고정값(예: 0.85)으로 두면, 나중에 TOUCH_SENSITIVITY를 조정할 때마다
// "손떨림 몇 px까지 허용할지"가 같이 바뀌어버려서 또 이 버그가 재발한다(실제로 민감도를
// 올렸다가 재발했었다). 그래서 "터치 이동 거리 기준 몇 px까지의 흔들림을 허용할지"를 기준으로 두고,
// 거기에 현재 민감도를 곱해서 임계값을 역산한다 — 민감도가 바뀌어도 손떨림 허용 폭(px)은 그대로다.
const RELEASE_TOLERANCE_PX = 60
const GATHER_RELEASE_THRESHOLD = 1 - RELEASE_TOLERANCE_PX * TOUCH_SENSITIVITY

// 위 임계값을 어쩌다 순간적으로 넘나드는 프레임이 또 섞이더라도(예: 아주 강한 손떨림) 화면에
// 그 흔들림이 그대로 보이지 않도록, "풀림(false)"만 이 시간(ms)만큼 붙잡아둔다. 그 사이 다시
// true로 돌아오면 풀림 자체를 취소해서 아이콘이 꺼졌다 켜지는 깜빡임 없이 계속 true로 남는다.
// 반대로 "모임(true)"은 지연 없이 즉시 반영한다 — 다 모이는 순간은 최대한 즉각적이어야 한다.
const GATHER_RELEASE_DEBOUNCE_MS = 150

// 다 모인 상태(isGrouped)를 URL 쿼리(?gathered=)로 남기면, 그 주소를 그대로 복사해서 공유했을 때
// 링크를 받은 사람도 인트로 모션을 못 보고 바로 다 모인 상태로 열리는 문제가 있다. 그래서 눈에
// 보이는 URL에는 남지 않는 sessionStorage에 저장한다 — 다른 페이지로 갔다가 뒤로가기로 돌아오면
// (같은 탭이라 세션이 유지되니) 모인 상태 그대로 돌아오고, 새 탭/새 방문자는 항상 빈 상태로
// 시작하며, 탭을 닫으면 사라진다.
const GATHERED_STORAGE_KEY = 'intro-gathered'

// 사용자가 직접 새로고침한 거라면(뒤로가기가 아니라), 이미 한 번 경험했더라도 인터랙션을 다시
// 체험할 수 있게 기억을 지운다. Navigation Timing API의 type은 "이 문서가 어떻게 로드됐는지"를
// 나타내는데, 문서 전체에 대해 한 번 정해지면 그 문서가 살아있는 내내 안 바뀐다 — 즉 소프트
// 네비게이션(다른 페이지 갔다 옴)으로 홈 페이지를 몇 번을 다시 마운트해도 값은 그대로다. 그래서
// 이 체크를 훅 안에서(마운트마다) 하면, 한 번이라도 진짜 새로고침을 거친 뒤로는 문서가 살아있는
// 내내 "새로고침"으로 오판해서 그 뒤로 뒤로가기 복원이 영영 안 먹힌다. 대신 모듈 최상단에서 딱
// 한 번만(=진짜 새 문서가 로드됐을 때만) 실행해서, 진짜 새로고침일 때만 1회성으로 지운다.
function isReloadNavigation() {
  if (typeof window === 'undefined' || !window.performance?.getEntriesByType) return false
  const [entry] = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  return entry?.type === 'reload'
}

if (typeof window !== 'undefined' && isReloadNavigation()) {
  sessionStorage.removeItem(GATHERED_STORAGE_KEY)
}

function getGatheredSnapshot() {
  return sessionStorage.getItem(GATHERED_STORAGE_KEY) === '1'
}

// 서버는 sessionStorage가 없으니 항상 흩어진 상태로 렌더한다.
function getGatheredServerSnapshot() {
  return false
}

function subscribeNever() {
  return () => {}
}

// useSyncExternalStore를 쓰면, 실제로 서버 렌더 결과와 맞춰야 하는 하이드레이션 렌더에서만
// React가 자동으로 getGatheredServerSnapshot(false)을 쓰고, 그 외의 순수 클라이언트 마운트
// (다른 페이지 갔다가 돌아오는 소프트 네비게이션)에서는 곧바로 실제 세션 값을 쓴다. 이걸 직접
// 판별하려 들면(예: 새로고침 여부만으로) back/forward가 실제 문서 재로드로 처리되는 드문
// 경우를 놓쳐서 hydration mismatch가 날 수 있는데, 이 방식은 그 구분을 React에 맡겨서 안전하다.
function useInitiallyGathered() {
  return useSyncExternalStore(subscribeNever, getGatheredSnapshot, getGatheredServerSnapshot)
}

function persistGathered(gathered: boolean) {
  sessionStorage.setItem(GATHERED_STORAGE_KEY, gathered ? '1' : '0')
}

// 글자가 흩어졌다가(0) 모이는(1) 진행도를 스크롤(휠/세로 스와이프) 입력으로 관리하는 훅.
export function useGatherProgress() {
  // 순수 클라이언트 마운트(뒤로가기 등)에서는 처음부터 실제 세션 값이라, 아래 progress/isGrouped
  // 초기값에 바로 반영되어 애니메이션 없이(모든 motion 컴포넌트의 initial={false} 덕분) 그 상태로
  // 시작한다. 실제 하이드레이션과 맞물린 드문 경우에만 처음엔 false였다가 아래 effect에서 뒤늦게 보정된다.
  const initiallyGathered = useInitiallyGathered()

  const [progress, setProgress] = useState(initiallyGathered ? 1 : 0)
  const [isGrouped, setIsGrouped] = useState(initiallyGathered)
  const [showIntroHint, setShowIntroHint] = useState(!initiallyGathered)
  const touchY = useRef<number | null>(null)
  // progress/isGrouped state는 리렌더를 거쳐야 갱신되므로, 같은 프레임 안에서 연달아 들어오는
  // touchmove 이벤트가 그 사이의 값을 못 보고 갱신 전 값을 기준으로 판단해 깜빡임이 생겼다.
  // 리렌더를 기다리지 않고 최신 값을 즉시 읽을 수 있도록 ref에도 동기적으로 값을 함께 들고 있는다.
  const progressRef = useRef(initiallyGathered ? 1 : 0)
  const isGroupedRef = useRef(initiallyGathered)
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(releaseTimer.current), [])

  // initiallyGathered가 하이드레이션 이후 뒤늦게 true로 바뀌는(진짜 문서 로드와 맞물린 드문 경우)
  // 상황에서만 상태를 마저 맞춘다. 순수 클라이언트 마운트에서는 이미 처음부터 맞는 값이라 이
  // effect가 사실상 할 일이 없다(같은 값으로 setState하면 리액트가 리렌더를 생략한다).
  useEffect(() => {
    if (!initiallyGathered) return
    progressRef.current = 1
    isGroupedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(1)
    setIsGrouped(true)
    setShowIntroHint(false)
  }, [initiallyGathered])

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
      persistGathered(true)
    } else if (next < GATHER_RELEASE_THRESHOLD && isGroupedRef.current && !releaseTimer.current) {
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = undefined
        isGroupedRef.current = false
        setIsGrouped(false)
        persistGathered(false)
      }, GATHER_RELEASE_DEBOUNCE_MS)
    }
  }

  // PC: 스크롤/트랙패드 = wheel. 모바일: 한 손가락 세로 스와이프 = 종스크롤.
  const handleWheel = (e: React.WheelEvent) => advance(e.deltaY * WHEEL_SENSITIVITY)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0].clientY
  }

  // 손가락이 위로 이동(clientY 감소)하는 걸 "아래로 스크롤"과 같은 방향으로 맞춰서,
  // wheel의 deltaY 양수(스크롤 다운)와 동일하게 진행도가 증가하도록 부호를 뒤집는다.
  const handleTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY
    if (touchY.current != null) advance((touchY.current - y) * TOUCH_SENSITIVITY)
    touchY.current = y
  }

  const handleTouchEnd = () => {
    touchY.current = null
  }

  return { progress, isGrouped, showIntroHint, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd }
}
