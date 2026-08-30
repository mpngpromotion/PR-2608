import { parseAsKst } from '@/components/lib/kstDate'

export interface GalleryPhoto {
  id: string
  src: string
  /** ISO date — 이 날짜부터 캐러셀에 노출 (타임존 표기 없으면 KST로 간주) */
  openDate: string
  /** true면 처음엔 블러 처리되어 있고, 문질러야 선명해짐 (미공개 컷) */
  initiallyBlurred: boolean
}

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  { id: 'g1', src: '/img/gallery/0908_01.webp', openDate: '2026-09-08', initiallyBlurred: false },
  { id: 'g2', src: '/img/gallery/0909_01.webp', openDate: '2026-09-09', initiallyBlurred: false },
  { id: 'g3', src: '/img/gallery/0909_01_blur.webp', openDate: '2026-09-09', initiallyBlurred: true },
  { id: 'g4', src: '/img/gallery/0909_02_blur.webp', openDate: '2026-09-09', initiallyBlurred: true },
  { id: 'g5', src: '/img/gallery/0910_01.webp', openDate: '2026-09-10', initiallyBlurred: false },
  { id: 'g6', src: '/img/gallery/0911_01.webp', openDate: '2026-09-11', initiallyBlurred: false },
  { id: 'g7', src: '/img/gallery/0911_01_blur.webp', openDate: '2026-09-11', initiallyBlurred: true },
  { id: 'g8', src: '/img/gallery/0911_02_blur.webp', openDate: '2026-09-11', initiallyBlurred: true },
]

export function isGalleryPhotoVisible(photo: GalleryPhoto, now: number): boolean {
  // 테스트용: true면 openDate와 무관하게 전부 노출한다 (배포 시 반드시 false 또는 미설정).
  if (process.env.NEXT_PUBLIC_GALLERY_IGNORE_OPEN_DATE === 'true') return true
  return parseAsKst(photo.openDate).getTime() <= now
}

/**
 * openDate가 지난 사진만, openDate가 최신인 순서로(오래된 사진일수록 뒤로) 반환한다. 같은
 * openDate끼리는 GALLERY_PHOTOS에 적어둔 순서를 그대로 유지한다(Array#sort는 안정 정렬).
 * 시각을 넘기지 않으면 호출 시점(Date.now())을 기준으로 삼는다.
 */
export function getVisibleGalleryPhotos(now: number = Date.now()): GalleryPhoto[] {
  return GALLERY_PHOTOS.filter((photo) => isGalleryPhotoVisible(photo, now)).sort(
    (a, b) => parseAsKst(b.openDate).getTime() - parseAsKst(a.openDate).getTime(),
  )
}
