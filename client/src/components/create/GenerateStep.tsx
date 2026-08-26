'use client'

import { useEffect, useState } from 'react'

import { generateVideoFromFrames } from './lib/videoEncoder'

export interface GeneratedVideoResult {
  url: string
  blob: Blob
  extension: 'mp4' | 'webm'
}

interface GenerateStepProps {
  photos: string[]
  onDone: (result: GeneratedVideoResult | null) => void
}

export function GenerateStep({ photos, onDone }: GenerateStepProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false

    generateVideoFromFrames({ photos, aspectRatio: '9:16', onProgress: (p) => !cancelled && setProgress(p) }).then(
      (video) => {
        if (cancelled) return
        onDone(video ? { url: URL.createObjectURL(video.blob), blob: video.blob, extension: video.extension } : null)
      },
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className='mx-auto flex aspect-9/16 w-full max-w-xs flex-col items-center justify-center gap-4 bg-zinc-500 text-white'>
      <p className='text-sm'>영상 만드는 중... {Math.round(progress * 100)}%</p>
      <div className='h-1 w-40 overflow-hidden rounded-full bg-white/30'>
        <div className='h-full bg-white transition-[width]' style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
