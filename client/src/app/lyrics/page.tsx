import { FadeInView, Header } from '@/components'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function LyricsPage() {
  return (
    <div className='w-full h-dvh flex flex-col justify-start items-center gap-8 py-10 text-center'>
      <FadeInView className='w-full'>
        <Header />
      </FadeInView>
      <FadeInView className='w-full h-full flex flex-col justify-center items-center gap-8 px-10' delay={0.1}>
        <span>
          <p>가사 게임 오픈 예정입니다.</p>
        </span>
      </FadeInView>
    </div>
  )
}
