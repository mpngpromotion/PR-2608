import type { Metadata } from 'next'
import { FadeInView, Header } from '@/components'
import classNames from 'classnames'
import Link from 'next/link'
import { LyricsGameGate } from './LyricsGameGate'
import lyricsData from './lyrics.json'

export const metadata: Metadata = {
  title: '가사 게임',
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

const AUDIO_SRC = '/audio/SORAN-이별직전.mp3'

const day1Segments = lyricsData.segments.slice(lyricsData.day1Range.start, lyricsData.day1Range.end + 1)

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function LyricsPage() {
  return (
    <div className='w-full h-dvh flex flex-col justify-start items-center pt-8 pb-5 text-center'>
      <FadeInView className='w-full'>
        <Header />
      </FadeInView>
      <FadeInView className='w-full h-full flex flex-col justify-center items-center pt-3' delay={0.1}>
        <LyricsGameGate allSegments={lyricsData.segments} day1Segments={day1Segments} audioSrc={AUDIO_SRC} />
      </FadeInView>
      {/* 소셜 미디어 링크 */}
      <FadeInView className='w-full h-fit flex flex-row items-center justify-center gap-4 pt-5'>
        {SOCIAL_SITES.map((site) => (
          <div key={site.name} className={classNames('w-[32px] h-[32px]', site.name === 'x' ? '-ml-1' : '')}>
            <Link href={site.link} target='_blank' rel='noopener noreferrer'>
              <img src={`/img/icons/${site.name}.png`} alt={site.name} className='w-full h-full object-contain' />
            </Link>
          </div>
        ))}
      </FadeInView>
    </div>
  )
}
