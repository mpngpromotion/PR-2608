'use client'

import { useEffect, useState } from 'react'

import { generateVideoFromFrames } from './lib/videoEncoder'

export interface GeneratedVideoResult {
  url: string
  blob: Blob
  extension: 'mp4' | 'webm'
  thumbnailUrl: string | null
  thumbnailBlob: Blob | null
}

interface GenerateStepProps {
  photos: string[]
  color: string
  onDone: (result: GeneratedVideoResult | null) => void
}

export function GenerateStep({ photos, color, onDone }: GenerateStepProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    // React StrictMode(개발 모드)에서는 이 effect가 mount → cleanup → mount로 두 번 실행된다.
    // cancelled 플래그만으로는 onDone 중복 호출만 막을 뿐 실제 인코딩(무거운 WebCodecs 작업)은
    // 계속 돌아가서 첫 번째(버려질) 실행이 CPU를 그대로 잡아먹는다 — AbortController로 첫
    // 실행 자체를 즉시 중단시킨다.
    const controller = new AbortController()

    generateVideoFromFrames({ photos, color, signal: controller.signal, onProgress: (p) => !cancelled && setProgress(p) })
      .then((video) => {
        if (cancelled) return
        onDone(
          video
            ? {
                url: URL.createObjectURL(video.blob),
                blob: video.blob,
                extension: video.extension,
                thumbnailUrl: video.thumbnailBlob ? URL.createObjectURL(video.thumbnailBlob) : null,
                thumbnailBlob: video.thumbnailBlob,
              }
            : null,
        )
      })
      .catch((error) => {
        if (cancelled || (error instanceof Error && error.name === 'AbortError')) return
        console.error(error)
        onDone(null)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className='flex-1' />
      <div className='flex-3 w-full flex flex-col items-center justify-center gap-4 px-4 text-lg'>
        <span className='w-fit h-fit'>영상 만드는 중... {Math.round(progress * 100)}%</span>
        <div className='h-0.5 w-40 overflow-hidden rounded-full bg-white/30'>
          <div className='h-full bg-white transition-[width]' style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className='flex-1' />
    </>
  )
}
