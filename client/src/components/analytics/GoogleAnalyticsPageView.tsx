'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { sendGAEvent } from '@next/third-parties/google'

// GoogleAnalytics(@next/third-parties)의 gtag('config', ...)는 최초 로드 시 1회만
// page_view를 보내고, App Router의 클라이언트 사이드 라우트 전환(router.push 등)에서는
// 다시 쏘지 않는다. GA4 관리자 콘솔의 "방문 기록 이벤트 기반 페이지 변경" Enhanced
// Measurement 옵션에 기대지 않고도 페이지별로 확실히 잡히도록, 라우트가 바뀔 때마다
// document.title(=해당 페이지의 <title>)을 담아 직접 page_view를 보낸다.
export function GoogleAnalyticsPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // 최초 렌더의 page_view는 GoogleAnalytics의 초기 config 호출이 이미 보냈으므로 건너뛴다.
    // dev의 React Strict Mode는 최초 마운트 시 이 effect를 cleanup→재실행까지 한 번 더
    // 겹쳐 돌리므로, cleanup에서 플래그를 되돌려놔야 그 두 번째 호출도 "첫 렌더"로
    // 인식해서 중복 전송을 안 한다.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return () => {
        isFirstRender.current = true
      }
    }
    const query = searchParams.toString()
    sendGAEvent('event', 'page_view', {
      page_title: document.title,
      page_path: query ? `${pathname}?${query}` : pathname,
      page_location: window.location.href,
    })
  }, [pathname, searchParams])

  return null
}
