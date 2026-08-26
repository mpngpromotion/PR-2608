'use client'

import { useEffect, useState } from 'react'
import { GALLERY_PHOTOS, GalleryPhoto, getVisibleGalleryPhotos, isGalleryPhotoVisible } from '@/data/gallery'
import { parseAsKst, MAX_TIMEOUT } from '../lib/kstDate'

// 아직 공개 안 된 사진 중 가장 이른 openDate(ms)를 반환한다. 다 지났으면 null.
function nextOpenAt(now: number): number | null {
  const upcoming = GALLERY_PHOTOS.filter((photo) => !isGalleryPhotoVisible(photo, now)).map((photo) =>
    parseAsKst(photo.openDate).getTime(),
  )
  return upcoming.length === 0 ? null : Math.min(...upcoming)
}

/**
 * openDate가 지난 사진만 노출한다. DisplayByDate/ActionByDate와 같은 방식으로 폴링 대신
 * 다음 공개 시각까지만 setTimeout을 걸어서, 페이지를 열어둔 채로도 새로고침 없이 사진이
 * 자동으로 나타나게 한다. 서버/클라이언트의 Date.now()가 어긋나 하이드레이션 불일치가
 * 나지 않도록 최초 렌더는 항상 빈 배열로 시작하고, 마운트 직후 effect에서 실제 목록으로
 * 갱신한다.
 */
export function useVisibleGalleryPhotos(): GalleryPhoto[] {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const check = () => {
      const now = Date.now()
      setPhotos(getVisibleGalleryPhotos(now))
      const nextAt = nextOpenAt(now)
      if (nextAt === null) return
      timer = setTimeout(check, Math.min(nextAt - now, MAX_TIMEOUT))
    }
    check()

    return () => clearTimeout(timer)
  }, [])

  return photos
}
