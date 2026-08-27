import { FadeInView, Header } from '@/components'
import { GalleryCarousel } from '@/components/gallery/GalleryCarousel'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function GalleryPage() {
  return (
    <div className='w-full h-dvh flex flex-col justify-start items-center gap-8 py-10 text-center'>
      <FadeInView className='w-full'>
        <Header />
      </FadeInView>
      <FadeInView className='flex-3 w-full flex justify-center' delay={0.1}>
        <GalleryCarousel />
      </FadeInView>
      <div className='flex flex-1' />
    </div>
  )
}
