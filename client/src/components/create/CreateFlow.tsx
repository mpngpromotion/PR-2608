'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'

import { VideoPlayer } from '@/components/VideoPlayer'
import { IntroGather } from './IntroGather'
import { GeneratedVideoResult } from './GenerateStep'
import { Header } from '../Header'

import DownloadIcon from '@/svg/download.svg'
import InstagramIcon from '@/svg/instagram.svg'
import KakaoTalkIcon from '@/svg/kakao.svg'
import classNames from 'classnames'
import { commonTransition } from '@/theme/transition'

// mood-film 페이지의 전체 흐름을 여기 하나로 모아둔다.
// 화면 전환(URL과 동기화되는 큰 단계)은 예시 영상 재생 → 인트로 → 완료, 3개뿐이다.
// 이름 입력/사진 선택/생성은 IntroGather 안에서 자체적으로 관리하는 하위 단계라 여기선 모른다
// (뒤로가기는 watching/intro/done 단위로만 동작).
const EXAMPLE_VIDEO_SRC = '/video/moodfilm.mp4'
type Step = 'watching' | 'intro' | 'done'
type ShareStatus = 'idle' | 'sharing'

function isStep(value: string | null): value is Step {
  return value === 'watching' || value === 'intro' || value === 'done'
}

// 단계 전환 시 세로로 살짝 밀리면서 페이드인/아웃.
const STEP_TRANSITION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.35, ease: 'easeInOut' },
} as const

export function CreateFlow() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // 현재 단계는 URL의 ?step= 쿼리가 정답이다. 뒤로가기/앞으로가기로 쿼리가 바뀌면 이 값도 같이 바뀐다.
  const stepParam = searchParams.get('step')
  const step: Step = isStep(stepParam) ? stepParam : 'watching'

  // "다시 만들기"를 누르면 IntroGather를 완전히 새로 마운트해서(사각형이 다시 흩어지고, 이름/사진
  // 입력도 초기화되게) 이 값을 올린다.
  const [introKey, setIntroKey] = useState(0)
  const [name, setName] = useState('')
  const [video, setVideo] = useState<GeneratedVideoResult | null>(null)
  // navigator.share는 서버(SSR)엔 없고 지원 브라우저도 제한적이라, lazy 초기값으로 클라이언트에서만 확인한다.
  const [canShare] = useState(() => typeof navigator !== 'undefined' && !!navigator.share)
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')

  // 단계 이동은 router.push로 history에 쌓아서, 뒤로가기 누르면 이전 단계로 돌아가게 한다.
  const goToStep = (next: Step) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', next)
    router.push(`${pathname}?${params.toString()}`)
  }

  const reset = () => {
    // "다시 만들기"는 예시 영상까지 다시 볼 필요는 없어서 인트로부터 시작한다.
    goToStep('intro')
    setIntroKey((key) => key + 1)
    setName('')
    setVideo(null)
  }

  // SNS 공유 시 같이 실리는 문구. 링크를 넣어서 공유받은 사람도 직접 만들어볼 수 있게 한다.
  const buildShareText = () => {
    const siteUrl = typeof window !== 'undefined' ? `${window.location.origin}` : ''
    return `${name || '무드필름'}의 Layer가 공유되었습니다.\nlayerbySORAN에서 나만의 Layer를 만들어보세요!\n\n${siteUrl}`
  }

  const handleShareVideo = async () => {
    if (!video || shareStatus !== 'idle') return
    const file = new File([video.blob], `${name || 'layer'}.${video.extension}`, { type: video.blob.type })

    if (!navigator.canShare?.({ files: [file] })) {
      alert('이 브라우저에서는 파일 공유가 지원되지 않아요. 다운로드 후 공유해주세요.')
      return
    }

    setShareStatus('sharing')
    try {
      await navigator.share({ files: [file], text: buildShareText() })
    } catch (error) {
      // 사용자가 공유 시트를 취소한 경우(AbortError)는 정상 흐름이라 조용히 넘어간다.
      if (error instanceof Error && error.name !== 'AbortError') {
        alert(`이 브라우저에서는 파일 공유가 지원되지 않아요. 다운로드 후 공유해주세요.`)
      }
    } finally {
      setShareStatus('idle')
    }
  }

  // 카카오톡이 Web Share로 영상을 넘겼을 때 조용히 실패하던 시기에 만든 대안 — 지금은 카카오도
  // 영상 공유가 정상 동작해서 버튼에 연결돼있진 않지만, 나중에 다시 문제가 생기면 이 함수로
  // 교체해서 쓸 수 있도록 지우지 않고 남겨둔다.
  const handleShareThumbnail = async () => {
    if (!video?.thumbnailBlob || shareStatus !== 'idle') return

    setShareStatus('sharing')
    try {
      const file = new File([video.thumbnailBlob], `${name || 'layer'}-thumbnail.jpg`, {
        type: video.thumbnailBlob.type,
      })

      if (!navigator.canShare?.({ files: [file] })) {
        alert('이 브라우저에서는 파일 공유가 지원되지 않아요.')
        return
      }

      await navigator.share({ files: [file], text: buildShareText() })
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        alert(`이 브라우저에서는 파일 공유가 지원되지 않아요. 다운로드 후 공유해주세요.`)
      }
    } finally {
      setShareStatus('idle')
    }
  }

  return (
    // 각 단계는 세로로 살짝 밀리면서 페이드인/아웃 — mode='wait'라 이전 단계가 다 사라진
    // 뒤에야 다음 단계가 나타난다 (겹쳐서 번쩍이지 않는다).
    <AnimatePresence mode='wait'>
      {step === 'watching' && (
        <motion.div
          key='watching'
          {...STEP_TRANSITION}
          className='w-full h-dvh  flex flex-col justify-start items-center gap-8 py-10 text-center'
        >
          <Header />
          {/* min-h-0가 없으면 flex 아이템은 콘텐츠(영상) 크기 이하로 안 줄어들어서 h-dvh를 넘겨버린다.
              VideoPlayer는 가로(w-full) 대신 세로(h-full) 기준으로 크기를 잡아서, 남는 세로 공간만큼만
              차지하고 그만큼 자동으로 작아진다. */}
          <div className='flex min-h-0 w-full flex-1 items-center justify-center p-8'>
            <VideoPlayer
              src={EXAMPLE_VIDEO_SRC}
              onEnded={() => goToStep('intro')}
              className='h-full w-auto max-w-full shadow-lg'
            />
          </div>
        </motion.div>
      )}

      {step === 'intro' && (
        <motion.div key='intro' {...STEP_TRANSITION} className='w-full  h-dvh'>
          <IntroGather
            key={introKey}
            onDone={(result, submittedName) => {
              setVideo(result)
              setName(submittedName)
              goToStep('done')
            }}
          />
        </motion.div>
      )}

      {step === 'done' && (
        <motion.div key='done' {...STEP_TRANSITION} className='w-full h-dvh  flex flex-col items-center text-center'>
          <div className='h-fit shrink-0  flex w-screen! flex-col items-center break-keep justify-center gap-4 px-10 pt-8 pb-6 text-base bg-black/30 text-white'>
            <Header className='' />
            <span className='w-fit h-fit'>{name ? `${name}` : '무드필름'}의 Layer가 완성되었습니다.</span>
          </div>

          {/* h-full은 "부모 전체 높이의 100%"라 헤더/버튼 블록 높이까지 더해지면 h-dvh를 넘긴다.
              flex-1(남는 공간만 차지) + min-h-0(콘텐츠 크기 이하로도 줄어들 수 있게)를 써야
              헤더·버튼 블록 높이를 뺀 나머지 공간에만 자리 잡는다. */}
          <div className='flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 p-4'>
            {video ? (
              <>
                {/* 이 안에 영상 + 아래 라벨(span) 두 개가 있어서, 영상도 h-full이 아니라
                    flex-1/min-h-0로 감싼 자리 안에서만 커야 라벨 자리를 침범하지 않는다. */}
                <div className='flex min-h-0 w-full flex-1 items-center justify-center'>
                  <VideoPlayer
                    src={video.url}
                    thumbnailUrl={video.thumbnailUrl}
                    className='h-full w-auto max-w-full shadow-sm'
                  />
                </div>
                <span className='text-lg text-nowrap leading-none mt-3 mb-1'>
                  {name ? `${name}` : '무드필름'}&apos;s Layer
                </span>
              </>
            ) : (
              <p className='text-sm opacity-60'>영상을 만들지 못했어요. 사진 형식을 확인해주세요.</p>
            )}
          </div>

          <div className='h-fit shrink-0  flex w-screen! flex-col items-center justify-center gap-6 px-10 pb-6 pt-6 bg-black/30 text-white'>
            <div className='flex flex-wrap justify-center gap-2'>
              {video && (
                <div className='flex flex-row items-center justify-center gap-4'>
                  <a href={video.url} download={`${name || 'layer'}.${video.extension}`} className=''>
                    <DownloadIcon className='w-[32px] h-[32px]' />
                  </a>
                  {canShare && (
                    <button
                      type='button'
                      onClick={handleShareVideo}
                      disabled={shareStatus !== 'idle'}
                      className='disabled:opacity-40'
                    >
                      <InstagramIcon
                        className={classNames('w-[32px] h-[32px]', shareStatus === 'sharing' ? 'animate-pulse' : '')}
                      />
                    </button>
                  )}
                  {canShare && (
                    <button
                      type='button'
                      onClick={handleShareVideo}
                      disabled={shareStatus !== 'idle'}
                      className='disabled:opacity-40'
                    >
                      <KakaoTalkIcon
                        className={classNames('w-[32px] h-[32px]', shareStatus === 'sharing' ? 'animate-pulse' : '')}
                      />
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* {canShare && <p className='text-xs opacity-70'>공유 후 화면이 안 움직이면 화면을 한 번 탭해주세요.</p>} */}
            <button
              type='button'
              onClick={reset}
              className={classNames(
                'border border-white text-sm text-white px-4 py-2 disabled:opacity-40',
                commonTransition,
              )}
            >
              다시 만들기
            </button>
            {/* iOS Safari의 알려진 버그: 공유 후 이전 화면이 반투명하게 남아 터치를 가로챌 때가 있다.
                JS로는 고칠 수 없는 WebKit 버그라(https://github.com/expo/expo/issues/43774),
                화면을 한 번 탭하면 없어진다는 걸 안내한다. */}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
