'use client'

import { useEffect, useState } from 'react'
import { parseAsKst, MAX_TIMEOUT } from './lib/kstDate'

export const DisplayByDate = ({
  date,
  children,
}: {
  /** 기준 시각. 타임존 표기가 없으면 KST로 간주 (예: '2026-09-17', '2026-09-17 09:00:00', '2026-09-17T09:00:00'). */
  date: string
  /** isAfter: 기준 시각이 지났으면 true. 텍스트/스타일 분기는 호출부에서 이 값으로 처리. */
  children: (isAfter: boolean) => React.ReactNode
}) => {
  const [isAfter, setIsAfter] = useState(false)

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

  return <>{children(isAfter)}</>
}
