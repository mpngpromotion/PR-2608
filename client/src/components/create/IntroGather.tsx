'use client'

import { useRef, useState, ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { GenerateStep, GeneratedVideoResult } from './GenerateStep'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import classNames from 'classnames'
import { commonTransition } from '@/theme/transition'

// 메인 인트로(GatherLetters)와 좌표 체계가 동일하다: x/y는 컨테이너 정중앙(0)에서 얼마나
// 떨어졌는지를 컨테이너 가로/세로 기준 %값으로 나타낸다 (-50/+50 = 좌/상단 끝, 우/하단 끝).
interface GatherPoint {
  x: number
  y: number
  /** degree 단위. */
  rotate: number
}

interface GatherItem {
  /** 흩어져있을 때 위치 */
  scatter: GatherPoint
  /** 다 모였을 때 위치 — 전부 같은 값으로 두면 한 점으로 모이고, 각자 다르게 주면 원하는 배치로 모을 수 있다. */
  grouped: GatherPoint
}

// 메인 인트로의 글자 5개(L A Y E R) 배치를 그대로 가져오고, 안에 들어가는 이미지만 뺐다.
// 나중에 실제 이미지(사진 등)를 넣을 자리라 지금은 빈 사각형이다.
const GATHER_ITEMS: GatherItem[] = [
  { scatter: { x: -30, y: -45, rotate: -15 }, grouped: { x: 0, y: 0, rotate: -2 } },
  { scatter: { x: 50, y: -24, rotate: 20 }, grouped: { x: 2, y: 0, rotate: 0 } },
  { scatter: { x: -34, y: 0, rotate: -130 }, grouped: { x: -2, y: -1, rotate: -4 } },
  { scatter: { x: 40, y: 23, rotate: 15 }, grouped: { x: 0, y: 0, rotate: -4 } },
  { scatter: { x: -42, y: 45, rotate: -15 }, grouped: { x: 0, y: 0, rotate: 4 } },
]

function offsetToPercent(offset: number) {
  return `${50 + offset}%`
}

export interface GatherSpring {
  /** 모이는 데 걸리는 대략적인 시간(초). 값을 올리면 느려지고, 내리면 빨라진다. */
  duration: number
  /** 튕기는 정도(0~1). 0에 가까울수록 안 튕기고 부드럽게 멈추고, 1에 가까울수록 많이 튕긴다. */
  bounce: number
}

// type은 여전히 'spring'이지만, stiffness/damping 대신 duration/bounce로 조절한다
// (프레이머모션이 지원하는 스프링 파라미터화 방식이라 트랜지션 종류 자체는 안 바뀐다).
const DEFAULT_SPRING: GatherSpring = { duration: 3, bounce: 0 }

// 사각형이 다 모인 뒤, 이름 입력 → 사진 선택 → 생성으로 이어지는 하위 단계도 여기서 다 관리한다.
type Phase = 'gathering' | 'naming' | 'picking' | 'generating'

// 하위 단계 전환 시 세로로 살짝 밀리면서 페이드인/아웃.
const PHASE_TRANSITION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: 'easeInOut' },
} as const

interface IntroGatherProps {
  /** 이름 입력 → 사진 선택 → 생성까지 다 끝났을 때 한 번 호출된다 (생성 실패 시 result는 null). */
  onDone: (result: GeneratedVideoResult | null, name: string) => void
  /** 모으는 속도. duration(초)만 바꿔도 되고, bounce로 튕기는 정도도 조절할 수 있다. */
  spring?: GatherSpring
}

const MIN_PHOTOS = 4
const MAX_PHOTOS = 12

// 기획안 화면 1~2: 화면을 터치하면 흩어진 사각형 5개가 메인 인트로(GatherLetters)와 똑같은
// 배치·크기로 중앙에 모인다. 터치 전엔 initial={false}라 애니메이션 없이 흩어진 채로 정지해있고,
// 터치하면 animate 타겟이 바뀌면서 스프링이 움직인다. 5개 전부 실제로 멈춘 뒤(onAnimationComplete)
// 안내 문구 자리에 이름 입력 → 사진 선택 → 생성이 이어서 나온다 — 사각형은 그대로 배경에 남는다.
export function IntroGather({ onDone, spring = DEFAULT_SPRING }: IntroGatherProps) {
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState<Phase>('gathering')
  const [name, setName] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  // 폰카메라 원본 사진은 용량이 커서 그리드 썸네일로 디코딩되는 데 눈에 띄게 걸릴 수 있어,
  // 다 디코딩된(onLoad) 사진만 여기 표시하고 그 전엔 스피너를 보여준다.
  const [loadedPhotoUrls, setLoadedPhotoUrls] = useState<Set<string>>(new Set())
  const settledCountRef = useRef(0)

  const handleTouch = () => setStarted(true)

  const handleItemSettled = () => {
    if (!started) return
    settledCountRef.current += 1
    if (settledCountRef.current >= GATHER_ITEMS.length) setPhase('naming')
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = '' // 같은 파일을 다시 골라도 onChange가 또 뜨도록 초기화
    if (files.length === 0) return

    setPhotos((prev) => [...prev, ...files.map((file) => URL.createObjectURL(file))].slice(0, MAX_PHOTOS))
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  return (
    <div
      onClick={handleTouch}
      className='relative flex h-full w-full items-center justify-center'
      style={{ '--gather-item-size': 'min(60%, 18rem)' } as React.CSSProperties}
    >
      {GATHER_ITEMS.map(({ scatter, grouped }, index) => {
        const target = started ? grouped : scatter
        return (
          <motion.div
            key={index}
            className='absolute aspect-square h-auto w-(--gather-item-size) bg-white border border-primary/50'
            style={{ x: '-50%', y: '-50%' }}
            initial={false}
            animate={{
              left: offsetToPercent(target.x),
              top: offsetToPercent(target.y),
              rotate: target.rotate,
            }}
            transition={{ type: 'spring', duration: spring.duration, bounce: spring.bounce }}
            onAnimationComplete={handleItemSettled}
          />
        )
      })}
      {phase === 'gathering' ? (
        <div
          className={classNames(
            'text-lg text-center text-primary pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-nowrap transition-opacity',
          )}
        >
          이제, 여러분의 Layer를 쌓아보세요
          <span
            className={classNames(
              'block text-sm pt-2 transition-opacity',
              started ? 'opacity-0' : 'opacity-100 animate-pulse',
            )}
          >
            화면을 터치하거나 클릭하면 시작합니다
          </span>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className='fixed inset-0 flex items-center justify-center bg-black/30 text-white'
        >
          <AnimatePresence mode='wait'>
            {phase === 'naming' && (
              <motion.div key='naming' {...PHASE_TRANSITION} className='w-full h-full flex flex-col items-center'>
                <div className='flex-1' />
                <div className='flex-1 w-fit flex flex-col justify-center items-center gap-8 text-lg relative'>
                  <span className='w-fit h-fit '>이름을 적어주세요.</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={10}
                    placeholder=''
                    className='w-48 border-b border-white bg-transparent px-2 text-center outline-none placeholder:text-white/70 caret-white'
                  />
                  <span className='absolute bottom-6 text-xs opacity-70'>{name.length}/10</span>
                </div>
                <div className='flex-1 flex w-fit flex-col items-center justify-center'>
                  <button
                    type='button'
                    disabled={!name.trim()}
                    onClick={() => setPhase('picking')}
                    className={classNames('border border-white px-4 py-2 disabled:opacity-40', commonTransition)}
                  >
                    다음
                  </button>
                </div>
              </motion.div>
            )}
            {phase === 'picking' && (
              <motion.div key='picking' {...PHASE_TRANSITION} className='w-full h-full flex flex-col items-center'>
                <div className='flex-1' />

                <div className='flex-3 w-full flex flex-col items-center justify-center gap-4 px-4 text-lg'>
                  <span className='w-fit h-fit'>사진을 선택해 주세요</span>

                  <div className='grid w-full max-w-sm grid-cols-4 gap-4 overflow-y-auto p-4'>
                    {photos.map((url, index) => (
                      <div key={url} className='relative aspect-square'>
                        {!loadedPhotoUrls.has(url) && (
                          <div className='absolute inset-0 flex items-center justify-center'>
                            <LoadingSpinner />
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=''
                          onLoad={() => setLoadedPhotoUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))}
                          className='h-full w-full rounded object-cover'
                        />
                        <button
                          type='button'
                          onClick={() => handleRemovePhoto(index)}
                          className='absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs text-black shadow transition-opacity hover:opacity-70'
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='currentColor'
                            className='h-3 w-3'
                          >
                            <path
                              fillRule='evenodd'
                              d='M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z'
                              clipRule='evenodd'
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <button
                        type='button'
                        onClick={() => fileInputRef.current?.click()}
                        className={classNames(
                          'flex aspect-square items-center justify-center rounded border border-dashed border-white/60 text-2xl',
                          commonTransition,
                        )}
                      >
                        +
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    multiple
                    onChange={handleAddPhotos}
                    className='hidden'
                  />

                  <span className='text-xs opacity-70'>
                    {photos.length}/{MAX_PHOTOS}장 · 최소 {MIN_PHOTOS}장
                  </span>
                </div>

                <div className='flex-1 flex w-fit flex-col items-center justify-center'>
                  <button
                    type='button'
                    disabled={photos.length < MIN_PHOTOS}
                    onClick={() => setPhase('generating')}
                    className={classNames('border border-white px-4 py-2 disabled:opacity-40', commonTransition)}
                  >
                    다음
                  </button>
                </div>
              </motion.div>
            )}
            {phase === 'generating' && (
              <motion.div key='generating' {...PHASE_TRANSITION} className='w-full h-full flex flex-col items-center'>
                <GenerateStep photos={photos} onDone={(result) => onDone(result, name)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
