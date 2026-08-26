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
  onDone: (result: GeneratedVideoResult | null) => void
}

export function GenerateStep({ photos, onDone }: GenerateStepProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false

    generateVideoFromFrames({ photos, aspectRatio: '3:4', onProgress: (p) => !cancelled && setProgress(p) }).then(
      (video) => {
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
      },
    )

    return () => {
      cancelled = true
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
