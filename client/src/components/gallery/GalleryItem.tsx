'use client'

import { GalleryPhoto } from '@/data/gallery'
import { ScrubRevealImage } from './ScrubRevealImage'

interface GalleryItemProps {
  photo: GalleryPhoto
  index: number
  onScrubStart?: () => void
}

const ROTATE_DEG = 2
// 스와이프 히트 영역(Swiper/SwiperSlide)은 부모에 꽉 채우고, 카드 자체 크기만 여기서 조절한다.
const CARD_WIDTH = '75%'

export function GalleryItem({ photo, index, onScrubStart }: GalleryItemProps) {
  const polaroid = '/img/polaroid.png'
  const rotateDeg = index % 2 === 0 ? -ROTATE_DEG : ROTATE_DEG

  return (
    <div
      className='w-full h-auto aspect-919/1417 relative'
      style={{
        width: CARD_WIDTH,
        transform: `rotate(${rotateDeg}deg)`,
        backgroundImage: `url(${polaroid})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <ScrubRevealImage
        src={photo.src ? photo.src : './img/dummy.jpg'}
        alt={photo.src ? 'Gallery photo' : 'Dummy image'}
        blurred={photo.initiallyBlurred}
        onScrubStart={onScrubStart}
        className='absolute transform -translate-x-1/2 aspect-720/953'
        style={{
          width: (724 / 919) * 100 + '%',
          top: (126 / 1417) * 100 + '%',
          left: 50 + '%',
        }}
      />
    </div>
  )
}
