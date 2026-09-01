'use client'

import { FadeInView, Header } from '@/components'
import { useRef } from 'react'
import YouTube, { YouTubePlayer, YouTubeProps } from 'react-youtube'

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function AlbumPage() {
  const playerRef = useRef<YouTubePlayer | null>(null)

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    // access to player in all event handlers via event.target
    playerRef.current = event.target
    event.target.pauseVideo()
  }

  // 페이지 아무 곳이나 클릭/터치하면 영상 재생 (iframe 내부 클릭은 cross-origin이라 버블링되지 않음)
  const handlePlayOnInteract = () => {
    playerRef.current?.playVideo()
  }

  const opts: YouTubeProps['opts'] = {
    height: '1080',
    width: '1440',
    host: 'https://www.youtube-nocookie.com', // 프라이버시 강화 모드 (콘솔의 광고 전환추적 CORS 에러 완화 목적)
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      rel: 0, //관련 동영상 표시하지 않음 (근데 별로 쓸모 없는듯..)
      modestbranding: 1, // 컨트롤 바에 youtube 로고를 표시하지 않음
    },
  }

  return (
    <div
      className='w-full h-dvh flex flex-col justify-start items-center gap-8 py-10 text-center'
      onClick={handlePlayOnInteract}
      onTouchStart={handlePlayOnInteract}
    >
      <FadeInView className='w-full'>
        <Header />
      </FadeInView>
      <div className=' w-full min-h-full h-fit pb-16 overflow-y-scroll flex flex-col justify-start items-center gap-8 px-10'>
        <FadeInView className='w-full flex flex-col justify-end items-center p-2' delay={0.1}>
          <img src='/img/title.png' alt='소란' className='w-40' />
        </FadeInView>
        <FadeInView className=' w-full text-sm break-keep px-4 flex flex-col justify-start items-center' delay={0.2}>
          <div className='flex-1'>
            <p>겹겹이 쌓인 사과 다섯알 입니다.</p>
            <p>모아보니 서로 다르고 또 같아서 즐겁습니다.</p>
            <p>떠올리면 행복해지는 앨범으로 오래 남기를.</p>
          </div>
          <br />
          <div className='flex-1 flex flex-col justify-center items-center'>
            <p>소란(SORAN) EP [Layer]</p>
          </div>
        </FadeInView>
        <FadeInView className='w-full flex justify-center items-center pb-5' delay={0.1}>
          <YouTube
            videoId='Q8PD6Ew1seo'
            className={'max-w-md w-full h-fit pb-6'} // defaults -> ''
            iframeClassName={'w-full h-auto aspect-3/4 shadow-md'} // defaults -> ''
            loading={undefined} // defaults -> undefined
            opts={opts}
            onReady={onPlayerReady}
            onPlay={() => {}} // defaults -> noop
            onPause={() => {}} // defaults -> noop
            onEnd={(e) => {
              e.target.stopVideo(0)
            }}
            onError={() => {}} // defaults -> noop
            onStateChange={() => {}} // defaults -> noop
            onPlaybackRateChange={() => {}} // defaults -> noop
            onPlaybackQualityChange={() => {}} // defaults -> noop
          />
        </FadeInView>
      </div>
    </div>
  )
}
