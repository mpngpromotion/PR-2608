export type ChapterId = 'mood-film' | 'create' | 'gallery'

export interface Chapter {
  id: ChapterId
  path: `/${ChapterId}`
  label: string
}

export const CHAPTERS: Chapter[] = [
  { id: 'mood-film', path: '/mood-film', label: '무드필름' },
  { id: 'create', path: '/create', label: '나만의 레이어 영상 만들기' },
  { id: 'gallery', path: '/gallery', label: '갤러리' },
]

/**
 * STUB — 지금은 모든 챕터가 항상 열려 있는 것으로 취급한다.
 * TODO(user): 챕터별 오픈 날짜를 정하고 Date.now()와 비교하는 로직을 여기 한 곳에만 추가.
 * 이 함수를 호출하는 다른 코드는 바꿀 필요 없음.
 */
export function isUnlocked(_chapterId: ChapterId): boolean {
  return true
}
