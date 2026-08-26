import { Suspense } from 'react'
import { CreateFlow } from '@/components/create/CreateFlow'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지.
// 예시 영상 재생 → 인트로 → 이름 입력 → 사진 선택 → 생성 → 완료까지의 전체 흐름은
// CreateFlow 안에 다 모아뒀다.
// CreateFlow가 useSearchParams로 단계를 URL과 동기화해서, Next.js 요구사항상 Suspense로 감싼다.
export default function MoodFilmPage() {
  return (
    <Suspense fallback={null}>
      <CreateFlow />
    </Suspense>
  )
}
