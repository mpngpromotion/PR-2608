import { GalleryCarousel } from '@/components/gallery/GalleryCarousel'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function GalleryPage() {
  return (
    <div className='w-full'>
      <GalleryCarousel />
    </div>
  )
}
