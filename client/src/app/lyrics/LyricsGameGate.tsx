'use client'

import { useEffect, useState } from 'react'
import { DisplayByDate } from '@/components'
import { LayeringGame, type LyricsSegment } from './LayeringGame'

// 곡 전체가 공개되는 시점. 1절 일부(day1Segments)는 별도 날짜 게이트 없이 기본으로 보여준다 —
// 메인 페이지(app/page.tsx)의 가사게임 아이콘 자체가 releaseDate('lyrics')(9/16) 이전엔
// /lyrics로 못 들어오게 막아주고 있어서 여기서 또 막을 필요가 없다.
const FULL_OPEN_DATE = '2026-09-18'

// DisplayByDate는 'use client' 컴포넌트라 렌더 프롭(children 함수)을 서버 컴포넌트인
// page.tsx에서 직접 넘길 수 없다(함수는 서버→클라이언트 경계를 못 건넘). 그래서 날짜 분기를
// 이 클라이언트 컴포넌트로 옮기고, page.tsx에서는 직렬화 가능한 데이터만 props로 넘긴다.
export const LyricsGameGate = ({
  allSegments,
  day1Segments,
  audioSrc,
}: {
  allSegments: LyricsSegment[]
  day1Segments: LyricsSegment[]
  audioSrc: string
}) => {
  // ?preview=full 로 9/18 이전에도 전체 버전을 미리 볼 수 있게 한다. 배포 환경에서도 동작한다.
  const [previewFull, setPreviewFull] = useState(false)
  useEffect(() => {
    // DisplayByDate와 동일한 이유로 setState 호출을 중첩 함수 안에 둔다 — 이 파일 최상단에
    // 직접 두면 react-hooks 린트가 "effect 안에서 동기적으로 setState 호출"로 잡아낸다.
    const applyPreview = () => {
      if (new URLSearchParams(window.location.search).get('preview') === 'full') setPreviewFull(true)
    }
    applyPreview()
  }, [])

  if (previewFull) return <LayeringGame segments={allSegments} audioSrc={audioSrc} />

  return (
    <DisplayByDate date={FULL_OPEN_DATE}>
      {(isFullOpen) => <LayeringGame segments={isFullOpen ? allSegments : day1Segments} audioSrc={audioSrc} />}
    </DisplayByDate>
  )
}
