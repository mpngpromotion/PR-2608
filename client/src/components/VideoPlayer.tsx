'use client'

import { useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { FiPause, FiPlay, FiVolume2, FiVolumeX } from 'react-icons/fi'
import { LoadingSpinner } from './LoadingSpinner'

// 재생 중 이 시간(ms) 동안 손을 안 대면 컨트롤(재생/멈춤·재생바·음소거)이 투명해진다.
const CONTROLS_HIDE_DELAY = 2500
// 영상이 끝난 뒤 onEnded를 바로 부르지 않고 이만큼(ms) 살짝 멈췄다가 다음 단계로 넘어간다.
const END_TRANSITION_DELAY = 700

interface VideoPlayerProps {
  src: string
  /** 재생 전 보여줄 썸네일. 없으면 첫 프레임을 직접 캡처해서 자동으로 만든다. */
  thumbnailUrl?: string | null
  /** 진입하자마자 자동 재생. 브라우저 정책상 muted와 함께 써야 한다. */
  autoPlay?: boolean
  muted?: boolean
  /** 영상이 끝까지 재생됐을 때 호출 (예: 예시 영상 다 보면 다음 단계로 넘어가기) */
  onEnded?: () => void
  className?: string
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// 3:4 비율 고정, object-contain으로 영상 비율에 맞춰 레터박스.
// 우리가 재생하는 건 항상 로컬 파일(blob/정적 mp4)이라 유튜브/비메오 같은 멀티 플랫폼 대응이
// 필요 없어서, react-player 없이 순수 <video>를 직접 다룬다 — ref로 진짜 seek이 가능해진다.
// 브라우저 네이티브 컨트롤/전체화면 전환 없이 재생/멈춤·재생바(seek 포함)·음소거만 지원한다.
export function VideoPlayer({ src, thumbnailUrl, autoPlay, muted, onEnded, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(() => !!autoPlay)
  const [hasStartedPlaying, setHasStartedPlaying] = useState(() => !!autoPlay)
  const [isMuted, setIsMuted] = useState(() => !!muted)
  const [autoThumbnail, setAutoThumbnail] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [isSeeking, setIsSeeking] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  // 실제 재생 가능한(canplay) 상태가 되기 전까진 재생/멈춤을 못 누르게 막는다 — 로딩 도중에
  // 토글이 여러 번 겹치면 재생 시간이 꼬이는 문제가 있었다.
  const [isReady, setIsReady] = useState(false)

  // isPlaying은 우리 상태일 뿐이라, 실제 재생/멈춤은 여기서 video 엘리먼트에 직접 명령한다.
  // isReady가 되기 전엔 play()를 호출하지 않는다(로딩 중 겹쳐서 상태가 꼬이는 걸 막는다).
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isReady) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying, hasStartedPlaying, isReady])

  // 재생 중 컨트롤이 보이는 상태가 되면(자동 표시든, 탭으로 직접 켰든) 잠깐 후 숨긴다.
  // showControls를 의존성에 넣어야, 탭으로 다시 보여줬을 때도 이 타이머가 재시작돼서
  // "탭으로 토글"과 "몇 초 후 자동 숨김"이 항상 같이 동작한다.
  useEffect(() => {
    if (!isPlaying || isSeeking || !showControls) return
    const timer = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY)
    return () => clearTimeout(timer)
  }, [isPlaying, isSeeking, showControls])

  const revealControls = () => setShowControls(true)

  // 빈 영역 탭(클릭/터치)은 보여주기 전용이 아니라 토글이다 — 이미 보이는 상태면 다시 눌러서 숨긴다.
  const toggleControls = (event: React.SyntheticEvent) => {
    event.stopPropagation()
    setShowControls((prev) => !prev)
  }

  // 재생/멈춤 버튼 자체를 눌렀을 때만 토글한다. 그 외 빈 영역 클릭/호버/터치는 컨트롤만 보여준다.
  // 처음 누르는 시점(hasStartedPlaying이 아직 false)엔 영상 엘리먼트가 막 마운트되는 참이라
  // isReady가 아니므로, 그때는 로딩만 시작시키고 재생 자체는 canplay가 뜬 뒤로 미룬다.
  const togglePlaying = (event: React.SyntheticEvent) => {
    event.stopPropagation()
    if (hasStartedPlaying && !isReady) return
    setHasStartedPlaying(true)
    setIsPlaying((prev) => !prev)
    revealControls()
  }

  const toggleMuted = (event: React.SyntheticEvent) => {
    event.stopPropagation()
    setIsMuted((prev) => !prev)
    revealControls()
  }

  const seekToClientX = (clientX: number) => {
    const bar = progressBarRef.current
    const video = videoRef.current
    if (!bar || !video || !duration) return
    const rect = bar.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    video.currentTime = fraction * duration
    setCurrentTime(fraction * duration)
  }

  const handleSeekPointerDown = (event: React.PointerEvent) => {
    event.stopPropagation()
    setIsSeeking(true)
    revealControls()
    seekToClientX(event.clientX)
  }

  // 드래그 중엔 포인터가 재생바를 벗어나도 계속 따라가야 해서 window에 직접 건다.
  useEffect(() => {
    if (!isSeeking) return
    const handleMove = (event: PointerEvent) => seekToClientX(event.clientX)
    const handleUp = () => setIsSeeking(false)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeeking, duration])

  const thumbnail = thumbnailUrl ?? autoThumbnail
  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className={classNames('relative aspect-3/4 bg-white', className)}>
      {/* thumbnailUrl을 안 주면 화면 밖에서 첫 프레임을 직접 캡처해서 포스터로 쓴다.
          preload="auto"만으론 iOS Safari 등 상당수 모바일 브라우저가 재생 전 프레임을 안 그려준다.
          display:none으로 숨기면 iOS Safari가 로드 자체를 안 해줄 때가 있어서, 화면 밖으로
          밀어내는 방식(1px + opacity 0)으로 숨긴다. */}
      {!thumbnailUrl && !autoThumbnail && (
        <video
          src={src}
          muted
          playsInline
          preload='auto'
          className='pointer-events-none absolute h-px w-px opacity-0'
          onLoadedData={(event) => {
            const video = event.currentTarget
            const capture = () => {
              if (!video.videoWidth) return
              const canvas = document.createElement('canvas')
              canvas.width = video.videoWidth
              canvas.height = video.videoHeight
              const ctx = canvas.getContext('2d')
              if (!ctx) return
              ctx.drawImage(video, 0, 0)
              setAutoThumbnail(canvas.toDataURL('image/jpeg', 0.85))
            }
            // iOS Safari는 muted여도 loadeddata 시점엔 실제 프레임을 디코딩 안 해둔 경우가 있어서,
            // 아주 짧게 재생했다 바로 멈춰서 디코딩을 강제로 트리거한 뒤 캡처한다.
            video
              .play()
              .then(() => {
                video.pause()
                capture()
              })
              .catch(capture)
          }}
        />
      )}

      {!hasStartedPlaying && thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt='' className='h-full w-full object-contain' />
      ) : (
        <video
          ref={videoRef}
          src={src}
          playsInline
          muted={isMuted}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => {
            setIsBuffering(false)
            setIsReady(true)
          }}
          onEnded={() => {
            setIsPlaying(false)
            // 끝나자마자 바로 다음 단계로 넘기지 않고 살짝 멈췄다 넘어가게 지연시킨다.
            if (onEnded) setTimeout(onEnded, END_TRANSITION_DELAY)
          }}
          className='h-full w-full object-contain'
        />
      )}

      {/* 포스터가 아직 준비 안 됐거나(썸네일 캡처 전), 영상을 눌렀지만 아직 재생 가능 상태가
          아니거나(isReady 전), 재생 중 버퍼링일 때 스피너를 보여준다. */}
      {((!hasStartedPlaying && !thumbnail) || (hasStartedPlaying && !isReady) || isBuffering) && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <LoadingSpinner className='text-black' />
        </div>
      )}

      {/* 빈 영역: 클릭/터치는 컨트롤 표시를 토글한다(보이면 숨기고, 숨어있으면 보여줌).
          호버(마우스 오버)는 계속 보여주기만 한다 — 마우스가 위에 있는 동안은 항상 보이는 게 자연스럽다.
          재생/멈춤은 이 토글과 별개로 아래 버튼 자체에만 건다. */}
      <div
        onClick={toggleControls}
        onMouseEnter={revealControls}
        onMouseMove={revealControls}
        className='absolute inset-0'
      />

      <button
        type='button'
        onClick={togglePlaying}
        disabled={hasStartedPlaying && !isReady}
        className={classNames(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white transition-opacity duration-500',
          showControls && !(hasStartedPlaying && !isReady) ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
      </button>

      {/* 재생바(시크 가능) + 시간 + 음소거. 재생/멈춤 버튼과 같은 showControls를 써서 같이 나타났다 사라진다. */}
      <div
        onMouseEnter={revealControls}
        onMouseMove={revealControls}
        className={classNames(
          'absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 text-xs text-white mix-blend-difference font-mono transition-opacity duration-500',
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <span className='tabular-nums'>{formatTime(currentTime)}</span>
        {/* 얇은 바(h-1) 자체는 손가락으로 누르기 힘들어서, 클릭 판정 영역(py-2)은 더 크게 잡는다. */}
        <div
          ref={progressBarRef}
          onPointerDown={handleSeekPointerDown}
          onClick={(event) => event.stopPropagation()}
          className='flex-1 cursor-pointer touch-none py-2'
        >
          <div className='h-0.5 w-full overflow-hidden bg-white/30'>
            <div className='h-full bg-white' style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <span className='tabular-nums'>{formatTime(duration)}</span>
        <button type='button' onClick={toggleMuted} className='shrink-0'>
          {isMuted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
        </button>
      </div>
    </div>
  )
}
