import { Header } from '@/components'
import { CreateFlow } from '@/components/create/CreateFlow'
import { MoodFilmOverlay } from '@/components/mood-film/MoodFilmOverlay'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function MoodFilmPage() {
  return (
    <div className='w-full h-dvh flex flex-col justify-start items-center gap-8 py-10 text-center'>
      <Header />
      {/* <MoodFilmOverlay /> */}
      <CreateFlow />
    </div>
  )
}
