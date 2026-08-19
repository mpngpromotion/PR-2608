'use client'

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/effect-cards'

// import required modules
import { EffectCards } from 'swiper/modules'

import { getVisibleGalleryPhotos } from '@/data/gallery'
import { GalleryPhoto } from '@/data/gallery'
import { useScrubReveal } from './useScrubReveal'

export function GalleryCarousel() {
  const photos = getVisibleGalleryPhotos()

  return (
    <Swiper
      className='h-full w-full '
      slidesPerView={1}
      effect={'cards'}
      cardsEffect={{
        // 스택 뒤 카드들의 자동 회전은 끄고, 카드 자체에 랜덤 회전을 입힌다.
        rotate: false,
        perSlideOffset: 8,
        perSlideRotate: 0,
        slideShadows: false,
      }}
      grabCursor={true}
      modules={[EffectCards]}
      // 이미지 위 canvas(문지르는 부분)에서 시작한 드래그는 슬라이드 넘김으로 취급하지 않는다.
      noSwipingSelector='canvas'
    >
      {photos.map((photo, index) => (
        <SwiperSlide
          key={photo.id}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
        >
          <GalleryItem photo={photo} index={index} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

interface GalleryItemProps {
  photo: GalleryPhoto
  index: number
}

const ROTATE_DEG = 2
// 스와이프 히트 영역(Swiper/SwiperSlide)은 부모에 꽉 채우고, 카드 자체 크기만 여기서 조절한다.
const CARD_WIDTH = '70%'

export function GalleryItem({ photo, index }: GalleryItemProps) {
  const { containerRef, canvasRef, bind } = useScrubReveal({ src: photo.src })
  const rotateDeg = index % 2 === 0 ? ROTATE_DEG : -ROTATE_DEG

  return (
    <div
      className='h-fit px-4 pt-4 pb-20 bg-white border border-black/10'
      style={{ width: CARD_WIDTH, transform: `rotate(${rotateDeg}deg)` }}
    >
      <div ref={containerRef} className='relative aspect-[3/4] h-auto w-full overflow-hidden'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src ? photo.src : './img/dummy.jpg'}
          className='h-full w-full object-cover'
          alt={photo.src ? 'Gallery photo' : 'Dummy image'}
        />

        {photo.initiallyBlurred && (
          <canvas {...bind()} ref={canvasRef} className='absolute inset-0 h-full w-full touch-none' />
        )}
      </div>
    </div>
  )
}
