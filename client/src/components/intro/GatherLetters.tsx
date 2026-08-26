'use client'

import { motion } from 'motion/react'

// 위치 기준: 글자의 "정중앙"이 기준점이고, x/y는 화면 정중앙(0)에서 얼마나 떨어졌는지를
// 디바이스 가로폭(dvw)/세로높이(dvh) 기준 %값을 단위 없는 숫자로 나타낸다. 중앙→끝 거리가 곧
// 화면의 50%이므로 -50/+50이 각각 왼쪽·위쪽 끝 / 오른쪽·아래쪽 끝이다.
// (예: x: -50, y: -50 = 글자 중심이 화면 왼쪽 위 끝에 위치. 중심 기준이라 이때 글자의 절반은 화면 밖으로 나간다)
// scatter = 흩어졌을 때 위치, grouped = 다 모였을 때 위치 — 둘 다 글자별로 관리 가능.
// (grouped를 전부 0, 0으로 두면 모든 글자의 중심이 화면 정중앙 한 점으로 모인다)
interface GatherPoint {
  x: number
  y: number
  /** degree 단위. */
  rotate: number
}

interface LetterGather {
  letter: string
  scatter: GatherPoint
  grouped: GatherPoint
}

// TODO(user): 실제 디자인에 맞게 좌표/회전값 조정
const CENTER: GatherPoint = { x: 0, y: 0, rotate: 0 }
const GATHER: LetterGather[] = [
  {
    letter: 'L',
    scatter: { x: -30, y: -45, rotate: -15 },
    grouped: CENTER,
  },
  {
    letter: 'A',
    scatter: { x: 50, y: -24, rotate: 20 },
    grouped: CENTER,
  },
  {
    letter: 'Y',
    scatter: { x: -34, y: 0, rotate: -130 },
    grouped: CENTER,
  },
  {
    letter: 'E',
    scatter: { x: 40, y: 23, rotate: 15 },
    grouped: CENTER,
  },
  {
    letter: 'R',
    scatter: { x: -42, y: 45, rotate: -15 },
    grouped: CENTER,
  },
]

// 중앙 기준 오프셋(%) 두 값을 보간한 뒤, 컨테이너 좌상단 기준 left/top(%)으로 변환.
// 컨테이너가 화면 전체(100dvw × 100dvh)라서 left/top(%)는 곧 디바이스 가로/세로 기준(%)과 같다.
function lerpOffsetToPercent(from: number, to: number, t: number) {
  const offset = from + (to - from) * t
  return `${50 + offset}%`
}

// 흩어진 글자들이 progress(0~1)에 따라 화면 중앙으로 모이는 애니메이션.
export function GatherLetters({ progress, isGrouped }: { progress: number; isGrouped: boolean }) {
  return (
    <>
      {GATHER.map(({ letter, scatter, grouped }) => (
        <motion.div
          key={letter}
          className='absolute z-10 flex aspect-square h-auto w-(--album-size) items-center justify-center mix-blend-multiply'
          style={{ x: '-50%', y: '-50%' }}
          initial={false}
          animate={{
            left: lerpOffsetToPercent(scatter.x, grouped.x, progress),
            top: lerpOffsetToPercent(scatter.y, grouped.y, progress),
            rotate: scatter.rotate + (grouped.rotate - scatter.rotate) * progress,
          }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
              boxShadow: isGrouped ? '2px 2px 6px rgba(0,0,0,0.05)' : '2px 2px 6px rgba(0,0,0,0.2)',
            }}
            style={{ pointerEvents: 'none' }}
            src={`/img/type/${letter}.png`}
            alt={letter}
            className='h-full w-full object-contain'
          />
        </motion.div>
      ))}
    </>
  )
}
