'use client'

import { useRef, useState } from 'react'
import classNames from 'classnames'
import { AnimatePresence, motion } from 'motion/react'

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
  const [activeIndex, setActiveIndex] = useState(0)
  // 한 번이라도 문지르기 시작하면 이후로는(다른 사진으로 넘어가도) 안내 문구를 다시 띄우지 않는다.
  const [hasScrubbed, setHasScrubbed] = useState(false)

  const syncEdges = (swiper: SwiperInstance) => {
    setIsBeginning(swiper.isBeginning)
    setIsEnd(swiper.isEnd)
    setActiveIndex(swiper.activeIndex)
  }

  // 공개된 사진이 아직 없으면(모든 openDate가 미래) Swiper를 슬라이드 0개로 띄우지 않는다.
  if (photos.length === 0)
    return (
      <div className={classNames('relative w-full max-w-lg', className)}>
        <div className='h-full w-full flex flex-col justify-center items-center text-sm text-zinc-400'>
          갤러리가 아직 공개되기 전이에요. <br />곧 공개될 예정입니다.
        </div>
      </div>
    )

  const activePhoto = photos[activeIndex]

  return (
    <div className={classNames('w-full max-w-lg flex flex-col items-center', className)}>
      <div className='relative w-full'>
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
              <GalleryItem photo={photo} index={index} onScrubStart={() => setHasScrubbed(true)} />
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

        <span className='absolute -bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs text-zinc-500 tabular-nums'>
          {activeIndex + 1} / {photos.length}
        </span>
      </div>

      {/* 지금 보고 있는 사진이 블러 처리된 경우에만, 문질러서 확인하라는 안내를 팝업처럼 띄운다.
          한 번이라도 문지르기 시작하면(hasScrubbed) 이미 배운 걸로 보고 더는 띄우지 않는다. */}
      <AnimatePresence>
        {activePhoto?.initiallyBlurred && !hasScrubbed && (
          <motion.p
            key='scrub-hint'
            className='mt-10 text-xs text-zinc-500'
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            화면을 문질러 사진을 확인해보세요.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
