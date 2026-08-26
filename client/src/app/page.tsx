/* eslint-disable @next/next/no-img-element */
'use client'

import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import {
  DisplayByDate,
  useGatherProgress,
  IntroHint,
  GatherLetters,
  GatheredBackground,
  MotionDiv,
  FloatingIcon,
  useFloatingPaths,
  ActionByDate,
  Crossfade,
} from '@/components'
import Link from 'next/link'

// true로 켜두면 아래 RELEASE_DATES 대신 TEST_DATE 하나가 모든 날짜 게이팅에 일괄 적용된다.
// 실제 배포 전엔 반드시 false로 되돌릴 것.
const IS_TEST = true
const TEST_DATE = '2026-08-26 13:10:00'

// 페이지 안에서 날짜 기준으로 텍스트/링크가 바뀌는 지점들을 한곳에서 관리.
const RELEASE_DATES = {
  epAnnounce: '2026-09-03 00:00:00', // "SORAN EP [Layer]" 문구 공개
  releaseDate: '2026-09-01 00:00:00', // "2026.09.18" 발매일 텍스트 공개
  album: '2026-09-13 00:00:00', // 앨범 소개 링크 활성화
  moodFilm: '2026-09-13 00:00:00', // 무드필름 링크 활성화
  gallery: '2026-09-13 00:00:00', // 갤러리 링크 활성화
  lyrics: '2026-09-13 00:00:00', // 가사게임 링크 활성화
} as const satisfies Record<string, string>

function releaseDate(key: keyof typeof RELEASE_DATES) {
  return IS_TEST ? TEST_DATE : RELEASE_DATES[key]
}

const SOCIAL_SITES = [
  {
    name: 'youtube',
    link: 'https://www.youtube.com/@bandsoran',
  },
  {
    name: 'insta',
    link: 'https://www.instagram.com/band_soran',
  },
  {
    name: 'x',
    link: 'https://x.com/band_SORAN',
  },
]

export default function Home() {
  const router = useRouter()
  const { progress, isGrouped, showIntroHint, handleWheel, handleTouchMove, handleTouchEnd } = useGatherProgress()
  // 앨범/무드필름/갤러리/가사게임 아이콘 4개가 서로 겹치지 않게 한 번에 경로를 만든다.
  const [albumPath, moodFilmPath, galleryPath, lyricsPath] = useFloatingPaths(4)

  return (
    <div
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ '--album-size': 'min(50vw, 28rem)' } as React.CSSProperties}
      className='relative h-dvh w-full touch-none'
    >
      <IntroHint show={showIntroHint} />
      <GatherLetters progress={progress} isGrouped={isGrouped} />
      <div
        id='gathered-links'
        className='pointer-events-none absolute inset-0 z-0 grid grid-cols-1 grid-rows-[1fr_var(--album-size)_1fr] justify-items-center '
      >
        <div id='top-space' className='w-full h-full min-h-0 flex flex-col gap-2 '>
          <div className='w-full h-full flex flex-row justify-between '>
            <div className={classNames('', 'flex-3 h-[80%] self-start', 'flex items-center justify-center')}>
              {/* 앨범 소개 */}
              <FloatingIcon path={albumPath} duration={38}>
                <MotionDiv id='icon-album' clickable className={classNames('w-24')} isDone={isGrouped}>
                  <ActionByDate date={releaseDate('album')} tempDuration={2000} onClick={() => router.push('/album')}>
                    {({ isRevealing, onClick }) => (
                      <button onClick={onClick} className='cursor-pointer'>
                        <Crossfade activeKey={isRevealing ? 'temp' : 'default'}>
                          {isRevealing ? (
                            <span className='text-center'>2026.09.03 OPEN</span>
                          ) : (
                            <img src='/img/icons/soran.png' alt='앨범' />
                          )}
                        </Crossfade>
                      </button>
                    )}
                  </ActionByDate>
                </MotionDiv>
              </FloatingIcon>
            </div>
            <div className='flex-1 ' />
            <div className={classNames('', 'flex-2 h-[50%] self-end', 'flex items-center justify-center')}>
              {/* 무드필름 만들기 */}
              <FloatingIcon path={moodFilmPath} duration={44} delay={2}>
                <MotionDiv id='icon-moodFilm' clickable className={classNames('w-24')} isDone={isGrouped}>
                  <ActionByDate
                    date={releaseDate('moodFilm')}
                    tempDuration={2000}
                    onClick={() => router.push('/mood-film')}
                  >
                    {({ isRevealing, onClick }) => (
                      <button onClick={onClick} className='cursor-pointer'>
                        <Crossfade activeKey={isRevealing ? 'temp' : 'default'}>
                          {isRevealing ? (
                            <span className='text-center'>2026.09.03 OPEN</span>
                          ) : (
                            <img src='/img/icons/moodflim.png' alt='무드필름' />
                          )}
                        </Crossfade>
                      </button>
                    )}
                  </ActionByDate>
                </MotionDiv>
              </FloatingIcon>
            </div>
          </div>
          <div className='w-full h-fit flex items-center justify-center pb-3 '>
            <MotionDiv className={classNames('text-lg text-nowrap text-center')} isDone={isGrouped}>
              <DisplayByDate date={releaseDate('epAnnounce')}>
                {(isAfter) => <span>{isAfter ? ' SORAN EP [Layer]' : 'ㅤ'}</span>}
              </DisplayByDate>
            </MotionDiv>
          </div>
        </div>

        <GatheredBackground isGrouped={isGrouped} />

        <div id='bottom-space' className='w-full h-full min-h-0 flex flex-col  gap-2'>
          <div className='w-full h-fit flex items-center justify-center pt-3'>
            <MotionDiv className={classNames('text-lg text-nowrap text-center')} isDone={isGrouped}>
              <DisplayByDate date={releaseDate('releaseDate')}>
                {(isAfter) => <span>{isAfter ? '2026.09.18' : 'ㅤ'}</span>}
              </DisplayByDate>
            </MotionDiv>
          </div>
          <div className='w-fulll h-full  flex flex-row justify-between gap-4'>
            <div className='flex-1 h-full flex flex-col justify-start items-center '>
              {/* 갤러리 */}
              <FloatingIcon path={galleryPath} duration={35} delay={4}>
                <MotionDiv id='icon-gallery' clickable className={classNames('w-14')} isDone={isGrouped}>
                  <ActionByDate
                    date={releaseDate('gallery')}
                    tempDuration={2000}
                    onClick={() => router.push('/gallery')}
                  >
                    {({ isRevealing, onClick }) => (
                      <button onClick={onClick} className='cursor-pointer'>
                        <Crossfade activeKey={isRevealing ? 'temp' : 'default'}>
                          {isRevealing ? (
                            <span className='text-center'>2026.09.08 OPEN</span>
                          ) : (
                            <img src='/img/icons/gallery.png' alt='갤러리' />
                          )}
                        </Crossfade>
                      </button>
                    )}
                  </ActionByDate>
                </MotionDiv>
              </FloatingIcon>
            </div>

            {/* 소셜 미디어 링크 */}
            <div className='h-full flex-1 flex flex-col shrink-0 justify-end items-center   '>
              <div className='w-fit h-fit flex flex-row items-center  justify-center gap-4'>
                {SOCIAL_SITES.map((site) => (
                  <MotionDiv
                    key={site.name}
                    clickable
                    className={classNames('w-10', site.name === 'x' ? '-ml-1' : '')}
                    isDone={isGrouped}
                  >
                    <Link href={site.link} target='_blank' rel='noopener noreferrer'>
                      <img
                        src={`/img/icons/${site.name}.png`}
                        alt={site.name}
                        className='w-full h-full object-contain'
                      />
                    </Link>
                  </MotionDiv>
                ))}
              </div>
              <div className='h-[35%]' />
            </div>

            <div className='h-full flex-1 flex flex-col justify-end items-center '>
              {/* 가사게임 */}
              <FloatingIcon path={lyricsPath} duration={41} delay={6}>
                <MotionDiv id='icon-lyrics' clickable className={classNames('w-24')} isDone={isGrouped}>
                  <ActionByDate date={releaseDate('lyrics')} tempDuration={2000} onClick={() => router.push('/lyrics')}>
                    {({ isRevealing, onClick }) => (
                      <button onClick={onClick} className='cursor-pointer'>
                        <Crossfade activeKey={isRevealing ? 'temp' : 'default'}>
                          {isRevealing ? (
                            <span className='text-center'>2026.09.15 OPEN</span>
                          ) : (
                            <img src='/img/icons/lyric.png' alt='가사 게임' />
                          )}
                        </Crossfade>
                      </button>
                    )}
                  </ActionByDate>
                </MotionDiv>
              </FloatingIcon>
              <div className='h-[12%]' />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
