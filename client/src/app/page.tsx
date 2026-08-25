'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import classNames from 'classnames'
import { commonTransition } from '@/theme/transition'

// 인트로 모션(스크롤/핀치로 확대·축소되는 상호작용)을 처음 접속한 사용자에게 알려주는 시간(ms).
const INTRO_HINT_DURATION = 3000

// 위치 기준: 글자의 "정중앙"이 기준점이고, x/y는 화면 정중앙(0)에서 얼마나 떨어졌는지를
// 디바이스 가로폭(dvw)/세로높이(dvh) 기준 %값을 단위 없는 숫자로 나타낸다. 중앙→끝 거리가 곧
// 화면의 50%이므로 -50/+50이 각각 왼쪽·위쪽 끝 / 오른쪽·아래쪽 끝이다.
// (예: x: -50, y: -50 = 글자 중심이 화면 왼쪽 위 끝에 위치. 중심 기준이라 이때 글자의 절반은 화면 밖으로 나간다)
// scatter = 흩어졌을 때 위치, grouped = 다 모였을 때 위치 — 둘 다 글자별로 관리 가능.
// (grouped를 전부 0, 0으로 두면 모든 글자의 중심이 화면 정중앙 한 점으로 모인다)
interface GatherPoint {
  x: number
  y: number
  /** degree 단위. */
  rotate: number
}

interface LetterGather {
  letter: string
  scatter: GatherPoint
  grouped: GatherPoint
}

// TODO(user): 실제 디자인에 맞게 좌표/회전값 조정
const CENTER: GatherPoint = { x: 0, y: 0, rotate: 0 }
const GATHER: LetterGather[] = [
  {
    letter: 'L',
    scatter: { x: -30, y: -45, rotate: -15 },
    grouped: CENTER,
  },
  {
    letter: 'A',
    scatter: { x: 50, y: -24, rotate: 20 },
    grouped: CENTER,
  },
  {
    letter: 'Y',
    scatter: { x: -34, y: 0, rotate: -130 },
    grouped: CENTER,
  },
  {
    letter: 'E',
    scatter: { x: 40, y: 23, rotate: 15 },
    grouped: CENTER,
  },
  {
    letter: 'R',
    scatter: { x: -42, y: 45, rotate: -15 },
    grouped: CENTER,
  },
]

// 중앙 기준 오프셋(%) 두 값을 보간한 뒤, 컨테이너 좌상단 기준 left/top(%)으로 변환.
// 컨테이너가 화면 전체(100dvw × 100dvh)라서 left/top(%)는 곧 디바이스 가로/세로 기준(%)과 같다.
function lerpOffsetToPercent(from: number, to: number, t: number) {
  const offset = from + (to - from) * t
  return `${50 + offset}%`
}

export default function Home() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [showIntroHint, setShowIntroHint] = useState(true)
  const pinchDist = useRef<number | null>(null)

  // 몇 초 뒤 자동으로 사라지고, 사용자가 실제로 조작을 시작하면 그 즉시 사라진다.
  useEffect(() => {
    const timer = setTimeout(() => setShowIntroHint(false), INTRO_HINT_DURATION)
    return () => clearTimeout(timer)
  }, [])

  const advance = (delta: number) => {
    setShowIntroHint(false)
    setProgress((p) => Math.min(1, Math.max(0, p + delta)))
  }

  // PC: 스크롤/트랙패드 = wheel. 모바일: 두 손가락 핀치 거리 변화 = zoom.
  const handleWheel = (e: React.WheelEvent) => advance(e.deltaY * 0.0015)

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return
    const a = e.touches[0]
    const b = e.touches[1]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (pinchDist.current != null) advance((dist - pinchDist.current) * 0.003)
    pinchDist.current = dist
  }

  const isGrouped = progress >= 1

  return (
    <div
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => (pinchDist.current = null)}
      className='relative h-dvh w-full touch-none overflow-hidden'
    >
      <AnimatePresence>
        {showIntroHint && (
          <motion.div
            key='intro-hint'
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className='pointer-events-none absolute top-[8%] left-1/2 z-20 -translate-x-1/2 text-nowrap rounded-full bg-black/70 px-4 py-2 text-xs text-white'
          >
            스크롤하거나 두 손가락으로 확대/축소해보세요
          </motion.div>
        )}
      </AnimatePresence>

      {GATHER.map(({ letter, scatter, grouped }) => {
        return (
          <motion.div
            key={letter}
            className='absolute z-10 flex aspect-square h-auto w-[50vw] max-w-md  items-center justify-center mix-blend-multiply'
            style={{ x: '-50%', y: '-50%' }}
            initial={false}
            animate={{
              left: lerpOffsetToPercent(scatter.x, grouped.x, progress),
              top: lerpOffsetToPercent(scatter.y, grouped.y, progress),
              rotate: scatter.rotate + (grouped.rotate - scatter.rotate) * progress,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          >
            <img src={`/img/type/${letter}.png`} alt={letter} className='h-full w-full object-contain' />
          </motion.div>
        )
      })}

      <motion.div
        id='gathered-background'
        style={{
          x: '-50%',
          y: '-50%',
          top: lerpOffsetToPercent(CENTER.y, CENTER.y, progress),
          left: lerpOffsetToPercent(CENTER.x, CENTER.x, progress),
        }}
        initial={false}
        animate={{
          backgroundColor: isGrouped ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)',
          boxShadow: isGrouped ? '0 0 20px rgba(0,0,0,0.2)' : '0 0 20px rgba(0,0,0,0)',
        }}
        // 글자들이 모이는 스프링 애니메이션이 끝난 뒤에야 배경/쉐도우가 서서히 나타나도록 지연시킨다.
        transition={{ duration: 0.4, delay: isGrouped ? 0.35 : 0, ease: 'easeOut' }}
        className='absolute z-0 aspect-square h-auto w-[50vw] max-w-md'
      >
        <motion.span
          initial={false}
          animate={{ opacity: isGrouped ? 1 : 0 }}
          transition={{ duration: 0.4, delay: isGrouped ? 0.35 : 0, ease: 'easeOut' }}

          className={classNames('absolute left-1/2 -translate-x-1/2 -top-16 text-lg text-nowrap text-center')}
        >
          SORAN EP [Layer]
        </motion.span>
        <motion.span
          initial={false}
          animate={{ opacity: isGrouped ? 1 : 0 }}
          transition={{ duration: 0.4, delay: isGrouped ? 0.35 : 0, ease: 'easeOut' }}
          className={classNames('absolute left-1/2 -translate-x-1/2 -bottom-16 text-lg text-nowrap text-center')}
        >
          2026.09.17
        </motion.span>
      </motion.div>

      {/* 다 모이면 나타나는 더미 링크 (페이드는 부모가 아닌 자식마다 개별 적용) */}
      <div className='pointer-events-none absolute inset-0 z-0 checking flex flex-col justify-between items-center'>
        {/* 가이드 */}
        <div id='top-space' className='checking border-blue-600 w-full h-full grid grid-cols-6 grid-rows-6'>
          {[...Array(36)].map((_, i) => (
            <div key={i} className='checking border-blue-600 w-full h-full'></div>
          ))}
        </div>

        <div
          id='album-space'
          className='checking border-blue-600 aspect-square h-auto w-[50vw] max-w-md shrink-0'
        ></div>
        <div id='bottom-space' className='checking border-blue-600 w-full h-full grid grid-cols-6 grid-rows-6'>
          {[...Array(36)].map((_, i) => (
            <div key={i} className='checking border-blue-600 w-full h-full'></div>
          ))}
        </div>

        <AliasAction
          tag='a'
          link='https://soranofficial.com'
          imgSrc={`/img/icons/soran.png`}
          imgAlt='소란 공식페이지'
          className={classNames('absolute top-[10%] left-14 w-28', commonTransition)}
          isGrouped={isGrouped}
        />

        {/* 무드필름 만들기 */}
        <AliasAction
          tag='button'
          link='/mood-film'
          imgSrc={`/img/icons/moodflim.png`}
          imgAlt='무드필름 만들기'
          className={classNames('absolute top-[18%] right-4 w-28', commonTransition)}
          isGrouped={isGrouped}
        />

        {/* 갤러리 */}
        <AliasAction
          tag='button'
          link='/gallery'
          imgSrc={`/img/icons/gallery.png`}
          imgAlt='갤러리'
          className={classNames('absolute bottom-[20%] left-20 w-16', commonTransition)}
          isGrouped={isGrouped}
        />

        {/* 가사게임 */}
        <AliasAction
          tag='button'
          link='/lyrics'
          imgSrc={`/img/icons/lyric.png`}
          imgAlt='가사 게임'
          className={classNames('absolute bottom-[8%] right-8 w-24', commonTransition)}
          isGrouped={isGrouped}
        />

        {/* 소셜 미디어 링크 */}
        <div className='absolute bottom-[8%] left-1/2 flex -translate-x-1/2 gap-4'>
          {[
            {
              name: 'youtube',
              link: 'https://www.youtube.com/@soranofficial',
            },
            {
              name: 'insta',
              link: 'https://www.youtube.com/@soranofficial',
            },
            {
              name: 'x',
              link: 'https://www.youtube.com/@soranofficial',
            },
          ].map((site) => (
            <AliasAction
              tag='a'
              key={site.name}
              link={site.link}
              imgSrc={`/img/icons/${site.name}.png`}
              imgAlt={site.name}
              className={classNames('w-12', site.name === 'x' ? '-ml-1' : '')}
              isGrouped={isGrouped}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const AliasAction = ({
  tag,
  link,
  imgSrc,
  imgAlt,
  className,
  isGrouped,
}: {
  tag: 'button' | 'a'
  link: string
  imgSrc: string
  imgAlt: string
  className?: string
  isGrouped: boolean
}) => {
  const router = useRouter()

  const handleClick = () => {
    router.push(link)
  }

  return (
    <>
      <motion.div
        className={classNames(className, commonTransition)}
        style={{ pointerEvents: isGrouped ? 'auto' : 'none' }}
        initial={false}
        animate={{ opacity: isGrouped ? 1 : 0 }}
        transition={{ duration: 0.4, delay: isGrouped ? 0.35 : 0, ease: 'easeOut' }}
      >
        {tag === 'a' ? (
          <a href={link} className='w-full h-full' target='_blank' rel='noopener noreferrer'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={imgAlt} className='w-full h-full object-contain' />
          </a>
        ) : (
          <button className='w-full h-full' onClick={handleClick}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={imgAlt} className='w-full h-full object-contain' />
          </button>
        )}
      </motion.div>
    </>
  )
}
