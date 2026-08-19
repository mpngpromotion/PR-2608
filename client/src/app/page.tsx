'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'

// 위치 기준: 화면 정중앙을 원점(0%, 0%)으로 하고, 그 점에서 얼마나 떨어졌는지를
// x = 디바이스 가로폭 기준 %, y = 디바이스 세로높이 기준 % 로 표현한다.
// (예: x: '-50%' = 화면 왼쪽 끝, y: '50%' = 화면 아래쪽 끝)
// scatter = 흩어졌을 때 위치, grouped = 다 모였을 때 위치 — 둘 다 글자별로 관리 가능.
// (grouped를 전부 '0%','0%'로 두면 지금처럼 정중앙 한 점으로 모인다)
interface GatherPoint {
  x: string
  y: string
  rotate: number
}

interface LetterGather {
  letter: string
  scatter: GatherPoint
  grouped: GatherPoint
}

// TODO(user): 실제 디자인에 맞게 좌표/회전값 조정
const GATHER: LetterGather[] = [
  {
    letter: 'L',
    scatter: { x: '-65%', y: '-28%', rotate: -12 },
    grouped: { x: '0%', y: '0%', rotate: 0 }
  },
  {
    letter: 'A',
    scatter: { x: '28%', y: '-32%', rotate: 8 },
    grouped: { x: '0%', y: '0%', rotate: 0 }
  },
  {
    letter: 'Y',
    scatter: { x: '32%', y: '18%', rotate: 5 },
    grouped: { x: '0%', y: '0%', rotate: 0 }
  },
  {
    letter: 'E',
    scatter: { x: '-32%', y: '22%', rotate: -6 },
    grouped: { x: '0%', y: '0%', rotate: 0 }
  },
  {
    letter: 'R',
    scatter: { x: '0%', y: '-40%', rotate: 3 },
    grouped: { x: '0%', y: '0%', rotate: 0 }
  },
]

const CHAPTERS = ['mood-film', 'create', 'gallery']

// 중앙 기준 오프셋(%) 두 값을 보간한 뒤, 컨테이너 좌상단 기준 left/top(%)으로 변환.
// 컨테이너가 화면 전체(100dvw × 100dvh)라서 left/top(%)는 곧 디바이스 가로/세로 기준(%)과 같다.
function lerpOffsetToPercent(from: string, to: string, t: number) {
  return `${50 + parseFloat(from) + (parseFloat(to) - parseFloat(from)) * t}%`
}

export default function Home() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const pinchDist = useRef<number | null>(null)

  const advance = (delta: number) => {
    setProgress((p) => Math.min(1, Math.max(0, p + delta)))
  }

  // PC: 스크롤/트랙패드 = wheel. 모바일: 두 손가락 핀치 거리 변화 = zoom.
  const handleWheel = (e: React.WheelEvent) => advance(e.deltaY * 0.0015)

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return
    const a = e.touches[0]
    const b = e.touches[1]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (pinchDist.current != null) advance((dist - pinchDist.current) * 0.003)
    pinchDist.current = dist
  }

  const isGrouped = progress >= 1

  return (
    <div
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => (pinchDist.current = null)}
      className="relative h-dvh w-full touch-none overflow-hidden"
    >
      {GATHER.map(({ letter, scatter, grouped }) => {
        return (
          <motion.div
            key={letter}
            className="absolute flex h-60 w-60 items-center justify-center border border-black/30 text-9xl font-bold"
            style={{ x: '-50%', y: '-50%' }}
            animate={{
              left: lerpOffsetToPercent(scatter.x, grouped.x, progress),
              top: lerpOffsetToPercent(scatter.y, grouped.y, progress),
              rotate: scatter.rotate + (grouped.rotate - scatter.rotate) * progress,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          >
            {letter}
          </motion.div>
        )
      })}

      {/* 다 모이면 나타나는 더미 링크 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center gap-4"
        initial={false}
        animate={{ opacity: isGrouped ? 1 : 0, y: isGrouped ? 0 : 16 }}
        transition={{ duration: 0.4 }}
        style={{ pointerEvents: isGrouped ? 'auto' : 'none' }}
      >
        {CHAPTERS.map((chapter) => (
          <div
            key={chapter}
            onClick={() => router.push(`/${chapter}`)}
            className="flex h-12 w-12 cursor-pointer items-center justify-center border border-black/30 bg-white/60 text-[10px]"
          >
            {chapter}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
