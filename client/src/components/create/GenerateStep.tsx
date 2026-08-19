'use client'

import { useEffect, useState } from 'react'

import { generateVideoFromFrames } from './lib/videoEncoder'

interface GenerateStepProps {
  photos: string[]
  onDone: (videoUrl: string | null) => void
}

export function GenerateStep({ photos, onDone }: GenerateStepProps) {
  const [isGenerating, setIsGenerating] = useState(true)

  useEffect(() => {
    let cancelled = false

    generateVideoFromFrames({ photos, aspectRatio: '9:16' }).then((blob) => {
      if (cancelled) return
      setIsGenerating(false)
      onDone(blob ? URL.createObjectURL(blob) : null)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <p className="text-sm opacity-70">{isGenerating ? '영상 만드는 중...' : '완료'}</p>
    </div>
  )
}
