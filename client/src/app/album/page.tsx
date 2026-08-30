import { FadeInView, Header } from '@/components'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function AlbumPage() {
  return (
    <div className='w-full h-dvh flex flex-col justify-start items-center gap-8 py-10 text-center'>
      <FadeInView className='w-full'>
        <Header />
      </FadeInView>
      <div className=' w-full h-full flex flex-col justify-center items-center gap-8 px-10'>
        <FadeInView className='w-full flex-4 flex flex-col justify-end items-center p-2' delay={0.1}>
          <img src='/img/title.png' alt='소란' className='w-full max-w-sm' />
        </FadeInView>
        <FadeInView
          className=' w-full flex-5 text-sm break-keep px-4 py-4 flex flex-col justify-start items-center'
          delay={0.2}
        >
          <div className='flex-1'>
            <p>겹겹이 쌓인 사과 다섯알 입니다.</p>
            <p>모아보니 서로 다르고 또 같아서 즐겁습니다.</p>
            <br />
            <p>떠올리면 행복해지는 앨범으로 오래 남기를.</p>
          </div>
          <div className='flex-1 flex flex-col justify-center items-center'>
            <p>소란(SORAN) EP [Layer]</p>
          </div>
        </FadeInView>
      </div>
    </div>
  )
}
