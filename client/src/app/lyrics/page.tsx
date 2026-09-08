import type { Metadata } from 'next'
import { FadeInView, Header } from '@/components'
import { LyricsGameGate } from './LyricsGameGate'
import { ShareButton } from './ShareButton'
import lyricsData from './lyrics.json'

export const metadata: Metadata = {
  title: '가사 게임',
}

const AUDIO_SRC = '/audio/SORAN-이별직전.mp3'
const DAY1_REPLAY_AUDIO_SRC = '/audio/이별직전_하이라이트메들리_구간 확인.mp3'

const day1Segments = lyricsData.segments.slice(lyricsData.day1Range.start, lyricsData.day1Range.end + 1)

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function LyricsPage() {
  return (
    <div className='lyrics-page relative w-full h-dvh flex flex-col justify-start items-center  text-center'>
      <FadeInView className='lyrics-page-header w-full shrink-0 pt-8'>
        <Header />
      </FadeInView>
      <FadeInView
        className='lyrics-game w-full min-h-0 flex-1 flex flex-col justify-center items-center pt-3'
        delay={0.1}
      >
        <LyricsGameGate
          allSegments={lyricsData.segments}
          day1Segments={day1Segments}
          audioSrc={AUDIO_SRC}
          day1ReplayAudioSrc={DAY1_REPLAY_AUDIO_SRC}
        />
      </FadeInView>
      {/* 공유하기 */}
      <FadeInView className='lyrics-share w-full h-fit shrink-0 flex flex-row items-center justify-center gap-4 pt-5 pb-5 '>
        <ShareButton />
      </FadeInView>
    </div>
  )
}
