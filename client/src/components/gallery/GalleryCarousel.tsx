'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
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
  const activePhoto = photos[activeIndex]

  // 안내 문구를 몇 초 뒤 자동으로 감춘다. 사진이 바뀌면(다시 돌아와도) 매번 다시 뜨고 다시
  // 몇 초 카운트다운이 시작된다 — 렌더 중에 이전 activeIndex와 비교해서 바뀌었으면 그 자리에서
  // 리셋한다(useEffect로 하면 한 프레임 늦게 리셋되면서 렌더가 한 번 더 도는 낭비가 생긴다).
  const [dismissed, setDismissed] = useState(false)
  const [prevActiveIndex, setPrevActiveIndex] = useState(activeIndex)
  if (activeIndex !== prevActiveIndex) {
    setPrevActiveIndex(activeIndex)
    setDismissed(false)
  }

  const HINT_DURATION_MS = 3000

  useEffect(() => {
    if (!activePhoto?.initiallyBlurred) return
    const timer = setTimeout(() => setDismissed(true), HINT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [activeIndex, activePhoto?.initiallyBlurred])

  // 블러가 어느 정도(useScrubReveal의 revealedThreshold) 지워진 사진은, 슬라이드가 안 사라지고
  // 그대로 남아있는 한(Swiper가 슬라이드를 언마운트하지 않으므로 지운 상태도 그대로 남는다)
  // 다시 돌아와도 토스트를 아예 안 띄운다. dismissed와 달리 사진이 바뀌어도 리셋되지 않는다.
  const [sufficientlyRevealedIndices, setSufficientlyRevealedIndices] = useState<Set<number>>(new Set())
  const markSufficientlyRevealed = (index: number) => {
    setSufficientlyRevealedIndices((prev) => (prev.has(index) ? prev : new Set(prev).add(index)))
  }

  // 토스트를 document.body에 포탈로 띄운다. 이 컴포넌트는 FadeInView(motion.div) 안에 있는데,
  // framer-motion이 남겨두는 transform 스타일이 조상에 있으면 position: fixed가 뷰포트가 아니라
  // 그 조상 기준으로 갇혀버린다. 포탈로 완전히 빠져나가야 화면 바닥에 확실히 고정된다.
  // 서버에는 document가 없고, 하이드레이션 직후 클라이언트에서 곧바로 포탈을 그리면 SSR 결과와
  // 달라져서 하이드레이션 경고가 나므로, 하이드레이션이 끝난 뒤에만 true가 되는
  // useSyncExternalStore로 마운트 여부를 판단한다(useEffect+setState보다 리렌더 한 번을 아낀다).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

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
              <GalleryItem photo={photo} index={index} onSufficientlyRevealed={() => markSufficientlyRevealed(index)} />
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

        <span className='absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 text-sm text-zinc-400 tabular-nums'>
          {activeIndex + 1} / {photos.length}
        </span>
      </div>

      {/* 지금 보고 있는 사진이 블러 처리된 경우에만, 화면 하단에 토스트처럼 띄운다.
          HINT_DURATION_MS가 지나면(dismissed) 자동으로 사라지고, 다른 사진으로 갔다 오면
          다시 뜬다. 다만 이미 어느 정도 블러가 지워진 사진(sufficientlyRevealedIndices)은
          다시 돌아와도 아예 띄우지 않는다. document.body에 포탈로 그려서 뷰포트 바닥에
          확실히 고정한다. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {activePhoto?.initiallyBlurred && !dismissed && !sufficientlyRevealedIndices.has(activeIndex) && (
              <motion.div
                key='scrub-hint'
                className='pointer-events-none fixed inset-x-0 z-50 flex select-none justify-center px-4'
                style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <span className='text-sm text-zinc-500'>화면을 문질러 사진을 확인해보세요.</span>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
