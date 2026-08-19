export interface GalleryPhoto {
  id: string
  src: string
  /** ISO date — 이 날짜부터 캐러셀에 노출 */
  openDate: string
  /** true면 처음엔 블러 처리되어 있고, 문질러야 선명해짐 (미공개 컷) */
  initiallyBlurred: boolean
}

// TODO(user): 실제 싱글/EP 사진 asset과 공개 일정으로 교체 (9/9~14 업데이트)
export const GALLERY_PHOTOS: GalleryPhoto[] = [
  { id: 'g1', src: '/img/sorantest.jpg', openDate: '2026-09-09', initiallyBlurred: false },
  { id: 'g2', src: '/img/sorantest.jpg', openDate: '2026-09-10', initiallyBlurred: true },
  { id: 'g3', src: '/img/sorantest.jpg', openDate: '2026-09-11', initiallyBlurred: true },
  { id: 'g4', src: '/img/sorantest.jpg', openDate: '2026-09-14', initiallyBlurred: true },
]

/**
 * STUB — openDate 기반 필터링은 아직 하지 않는다 (날짜 게이팅은 의도적으로 나중에 붙임).
 * TODO(user): Date.now() 와 openDate를 비교해서 아직 안 된 사진은 여기서 제외.
 */
export function getVisibleGalleryPhotos(): GalleryPhoto[] {
  return GALLERY_PHOTOS
}
