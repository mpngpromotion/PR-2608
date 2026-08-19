'use client'

import { useEffect, useState } from 'react'

import { GatherStack, GatherStackItem } from '@/components/shared/GatherStack'
import { tweenProgress } from '@/components/shared/tween'

const GATHER_DURATION = 1400

interface CreateGatherProps {
  photos: string[]
  onComplete: () => void
}

// 인트로와 동일한 GatherStack + tween을 사용자의 사진으로 재사용.
// 인트로는 스크롤/핀치 "행위"가 트리거가 되지만, 여기는 선택 완료 즉시 자동으로 재생된다.
export function CreateGather({ photos, onComplete }: CreateGatherProps) {
  const [progress, setProgress] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => tweenProgress(GATHER_DURATION, setProgress, onComplete), [])

  const items: GatherStackItem[] = photos.map((src, index) => ({
    id: src,
    // TODO(user): 인트로처럼 흩어지는 시작 위치를 사진 개수에 맞춰 더 다양하게 배치
    scatter: {
      x: (index % 2 === 0 ? -1 : 1) * (120 + index * 20),
      y: (index % 3 === 0 ? -1 : 1) * (100 + index * 16),
      rotate: (index % 2 === 0 ? -1 : 1) * 8,
      scale: 1,
    },
    node: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-32 w-32 border border-black/10 object-cover"
      />
    ),
  }))

  return (
    <div className="mx-auto aspect-9/16 w-full max-w-xs overflow-hidden bg-zinc-100">
      <GatherStack items={items} progress={progress} className="h-full w-full" />
    </div>
  )
}
