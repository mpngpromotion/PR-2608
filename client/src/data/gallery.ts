import { parseAsKst } from '@/components/lib/kstDate'

export interface GalleryPhoto {
  id: string
  src: string
  /** ISO date(-time) — 이 시각부터 캐러셀에 노출 (타임존 표기 없으면 KST로 간주) */
  openDate: string
  /** true면 처음엔 블러 처리되어 있고, 문질러야 선명해짐 (미공개 컷) */
  initiallyBlurred: boolean
}

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  { id: 'g1', src: '/img/gallery/g1.webp', openDate: '2026-09-08 18:00:00', initiallyBlurred: false },
  { id: 'g2', src: '/img/gallery/g2.webp', openDate: '2026-09-09 18:00:00', initiallyBlurred: false },
  { id: 'g3', src: '/img/gallery/g3.webp', openDate: '2026-09-09 18:00:00', initiallyBlurred: true },
  { id: 'g4', src: '/img/gallery/g4.webp', openDate: '2026-09-09 18:00:00', initiallyBlurred: true },
  { id: 'g5', src: '/img/gallery/g5.webp', openDate: '2026-09-10 18:00:00', initiallyBlurred: false },
  { id: 'g6', src: '/img/gallery/g6.webp', openDate: '2026-09-11 18:00:00', initiallyBlurred: false },
  { id: 'g7', src: '/img/gallery/g7.webp', openDate: '2026-09-11 18:00:00', initiallyBlurred: true },
  { id: 'g8', src: '/img/gallery/g8.webp', openDate: '2026-09-11 18:00:00', initiallyBlurred: true },
]

export function isGalleryPhotoVisible(photo: GalleryPhoto, now: number): boolean {
  // 테스트용: true면 openDate와 무관하게 전부 노출한다 (배포 시 반드시 false 또는 미설정).
  if (process.env.NEXT_PUBLIC_GALLERY_IGNORE_OPEN_DATE === 'true') return true
  return parseAsKst(photo.openDate).getTime() <= now
}

/**
 * openDate가 지난 사진만 공개 날짜가 최신인 순서로 반환한다.
 * 같은 날짜 안에서는 선명한 사진을 먼저, 블러 사진을 뒤에 배치하고,
 * 블러 여부도 같으면 GALLERY_PHOTOS에 적어둔 순서를 유지한다.
 * 시각을 넘기지 않으면 호출 시점(Date.now())을 기준으로 삼는다.
 */
export function getVisibleGalleryPhotos(now: number = Date.now()): GalleryPhoto[] {
  return GALLERY_PHOTOS.filter((photo) => isGalleryPhotoVisible(photo, now)).sort((a, b) => {
    const dateDifference = parseAsKst(b.openDate).getTime() - parseAsKst(a.openDate).getTime()
    if (dateDifference !== 0) return dateDifference
    return Number(a.initiallyBlurred) - Number(b.initiallyBlurred)
  })
}
