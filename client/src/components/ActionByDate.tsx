'use client'

import { useEffect, useRef, useState } from 'react'
import { parseAsKst, MAX_TIMEOUT } from './lib/kstDate'

export const ActionByDate = ({
  date,
  tempDuration = 2000,
  onClick,
  children,
}: {
  /** 기준 시각. 타임존 표기가 없으면 KST로 간주 (예: '2026-09-17', '2026-09-17 09:00:00', '2026-09-17T09:00:00'). */
  date: string
  /** 날짜 이전에 클릭했을 때 isRevealing이 true로 유지되는 시간(ms). 기본 2000ms. */
  tempDuration?: number
  /** 날짜 이후 클릭했을 때 실행할 실제 동작 (라우팅 등). */
  onClick: () => void
  /**
   * isAfter: 기준 시각이 지났으면 true.
   * isRevealing: 날짜 이전 클릭 직후 tempDuration 동안만 true — 이 동안 임시로 보여줄 요소를 렌더링.
   * onClick: 실제로 엘리먼트에 붙여야 하는 클릭 핸들러 (날짜 이후엔 위 onClick 실행, 이전엔 isRevealing만 토글).
   */
  children: (state: { isAfter: boolean; isRevealing: boolean; onClick: () => void }) => React.ReactNode
}) => {
  const [isAfter, setIsAfter] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const revealTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const target = parseAsKst(date).getTime()
    let timer: ReturnType<typeof setTimeout>

    const check = () => {
      const remaining = target - Date.now()
      if (remaining <= 0) {
        setIsAfter(true)
        return
      }
      setIsAfter(false)
      timer = setTimeout(check, Math.min(remaining, MAX_TIMEOUT))
    }
    check()

    return () => clearTimeout(timer)
  }, [date])

  useEffect(() => () => clearTimeout(revealTimer.current), [])

  const handleClick = () => {
    if (isAfter) {
      onClick()
      return
    }
    setIsRevealing(true)
    clearTimeout(revealTimer.current)
    revealTimer.current = setTimeout(() => setIsRevealing(false), tempDuration)
  }

  // handleClick은 실제 클릭 이벤트가 발생할 때만 revealTimer.current를 읽는다(렌더링 중엔 호출되지 않음).
  // eslint-disable-next-line react-hooks/refs
  return <>{children({ isAfter, isRevealing, onClick: handleClick })}</>
}
