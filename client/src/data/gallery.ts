import { parseAsKst } from '@/components/lib/kstDate'

export interface GalleryPhoto {
  id: string
  src: string
  /** ISO date — 이 날짜부터 캐러셀에 노출 (타임존 표기 없으면 KST로 간주) */
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

export function isGalleryPhotoVisible(photo: GalleryPhoto, now: number): boolean {
  return parseAsKst(photo.openDate).getTime() <= now
}

/** openDate가 지난 사진만 반환한다. 시각을 넘기지 않으면 호출 시점(Date.now())을 기준으로 삼는다. */
export function getVisibleGalleryPhotos(now: number = Date.now()): GalleryPhoto[] {
  return GALLERY_PHOTOS.filter((photo) => isGalleryPhotoVisible(photo, now))
}
