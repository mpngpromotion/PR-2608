'use client'

import { useRef, useState } from 'react'
import classNames from 'classnames'

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperInstance } from 'swiper/types'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/effect-cards'

// import required modules
import { EffectCards } from 'swiper/modules'

import { CarouselNavButton } from './CarouselNavButton'
import { GalleryItem } from './GalleryItem'
import { useVisibleGalleryPhotos } from './useVisibleGalleryPhotos'

export function GalleryCarousel({ className }: { className?: string }) {
  const photos = useVisibleGalleryPhotos()
  const swiperRef = useRef<SwiperInstance | null>(null)
  const [isBeginning, setIsBeginning] = useState(true)
  const [isEnd, setIsEnd] = useState(photos.length <= 1)

  const syncEdges = (swiper: SwiperInstance) => {
    setIsBeginning(swiper.isBeginning)
    setIsEnd(swiper.isEnd)
  }

  // 공개된 사진이 아직 없으면(모든 openDate가 미래) Swiper를 슬라이드 0개로 띄우지 않는다.
  if (photos.length === 0)
    return (
      <div className={classNames('relative w-full max-w-lg', className)}>
        <div className='h-full w-full flex flex-col justify-center items-center text-sm text-zinc-400'>
          공개된 사진이 아직 없습니다.
        </div>
      </div>
    )

  return (
    <div className={classNames('relative w-full max-w-lg', className)}>
      <Swiper
        className='h-full w-full overflow-visible'
        slidesPerView={1}
        effect={'cards'}
        cardsEffect={{
          // 스택 뒤 카드들의 자동 회전은 끄고, 카드 자체에 랜덤 회전을 입힌다.
          rotate: false,
          perSlideOffset: 4, // 카드 스택 간격
          perSlideRotate: 0,
          slideShadows: false,
        }}
        grabCursor={true}
        modules={[EffectCards]}
        // 이미지 위 canvas(문지르는 부분)에서 시작한 드래그는 슬라이드 넘김으로 취급하지 않는다.
        noSwipingSelector='canvas'
        onSwiper={(swiper) => {
          swiperRef.current = swiper
          syncEdges(swiper)
        }}
        onSlideChange={syncEdges}
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

      <CarouselNavButton
        side='left'
        label='이전 사진'
        src='/img/icons/left.png'
        disabled={isBeginning}
        onClick={() => swiperRef.current?.slidePrev()}
      />
      <CarouselNavButton
        side='right'
        label='다음 사진'
        src='/img/icons/right.png'
        disabled={isEnd}
        onClick={() => swiperRef.current?.slideNext()}
      />
    </div>
  )
}
