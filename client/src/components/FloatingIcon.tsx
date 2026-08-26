'use client'

import { motion } from 'motion/react'
import { ReactNode, useMemo, useSyncExternalStore } from 'react'

// 아이콘들이 화면 전체를 구름처럼 천천히 표류하는 래퍼. left/top(%)은 가장 가까운 positioned
// 조상(#gathered-links, absolute inset-0 → 곧 화면 전체) 기준 아이콘 "중심" 좌표다.
// 원래 자리에 상관없이 움직이되, 중앙 앨범 커버 자리·하단 소셜 버튼 자리(지점뿐 아니라 그 사이를
// 지나가는 이동 경로까지)와 서로의 경로를 피해서 지나간다.
interface Point {
  x: number
  y: number
}

interface Zone {
  x: [number, number]
  y: [number, number]
}

// 화면 가장자리에 아이콘이 붙지 않게 두는 여백.
const SCREEN_MARGIN: Zone = { x: [8, 92], y: [8, 92] }

// 겹치면 안 되는 두 영역. 실제 그리드 비율(앨범 =~ 화면 폭 50%, 중앙 정사각형 / 소셜 = 하단 줄 가운데)에
// 여유를 더한 근사치라, 정확한 픽셀 대신 넉넉한 비율로 잡았다.
const AVOID_ZONES: Zone[] = [
  { x: [18, 82], y: [28, 72] }, // 앨범 커버가 놓이는 중앙 정사각형 자리
  { x: [22, 78], y: [76, 100] }, // 소셜 버튼이 있는 하단 줄
]

// 한 걸음에 이동할 수 있는 최대 거리(%). 화면을 대각선으로 가로지르는 큰 점프 대신, 짧게 짧게
// 이어지는 걸음을 쌓아야 방향이 급격히 안 꺾이고 구름처럼 완만하게 흘러가는 느낌이 난다.
const MAX_STEP = 26
// 다른 아이콘의 경유지와 이 거리(%) 밑으로는 가까워지지 않도록 한다.
const ICON_KEEPOUT = 15

function inZone(x: number, y: number, zone: Zone) {
  return x >= zone.x[0] && x <= zone.x[1] && y >= zone.y[0] && y <= zone.y[1]
}

function isPointSafe(x: number, y: number) {
  return !AVOID_ZONES.some((zone) => inZone(x, y, zone))
}

// 두 점을 잇는 직선을 여러 지점으로 샘플링해, 구간 전체가 회피 영역을 가로지르지 않는지 확인한다.
function isSegmentSafe(a: Point, b: Point) {
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!isPointSafe(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false
  }
  return true
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isFarFromOthers(p: Point, others: Point[], minDist: number) {
  return others.every((o) => distance(p, o) >= minDist)
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function randomPoint(): Point {
  return {
    x: SCREEN_MARGIN.x[0] + Math.random() * (SCREEN_MARGIN.x[1] - SCREEN_MARGIN.x[0]),
    y: SCREEN_MARGIN.y[0] + Math.random() * (SCREEN_MARGIN.y[1] - SCREEN_MARGIN.y[0]),
  }
}

// from 주변의 짧은 거리 안에서 다음 후보 지점을 뽑는다(화면을 가로지르는 큰 점프 방지).
function randomStep(from: Point): Point {
  const angle = Math.random() * Math.PI * 2
  const dist = MAX_STEP * (0.35 + Math.random() * 0.65)
  return {
    x: clamp(from.x + Math.cos(angle) * dist, SCREEN_MARGIN.x[0], SCREEN_MARGIN.x[1]),
    y: clamp(from.y + Math.sin(angle) * dist, SCREEN_MARGIN.y[0], SCREEN_MARGIN.y[1]),
  }
}

// from에서 출발해, 회피 영역을 가로지르지 않고 다른 아이콘의 경유지들과도 거리를 두는 다음
// 지점을 찾는다. 그런 지점을 못 찾으면(다른 아이콘과의 거리 조건만) 완화해서 재시도한다 —
// 서로 겹치지 않는 건 "가능하면"이고, 회피 영역을 가로지르지 않는 건 항상 지켜야 하기 때문.
function nextPoint(from: Point, others: Point[]) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = randomStep(from)
    if (isPointSafe(candidate.x, candidate.y) && isSegmentSafe(from, candidate) && isFarFromOthers(candidate, others, ICON_KEEPOUT)) {
      return candidate
    }
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = randomStep(from)
    if (isPointSafe(candidate.x, candidate.y) && isSegmentSafe(from, candidate)) return candidate
  }
  return from // 정말 못 찾으면 제자리에 머무른다(경로를 가로지르는 것보단 낫다).
}

// waypoints개 지점을 순서대로 잇는 폐곡선 경로를 만든다. others에는 이미 만들어둔 다른 아이콘들의
// 경유지를 모두 넘겨, 그 지점들과 최대한 거리를 두고 지나가게 한다.
function buildWaypoints(count: number, others: Point[]) {
  let start = randomPoint()
  for (let guard = 0; guard < 100; guard++) {
    if (isPointSafe(start.x, start.y) && isFarFromOthers(start, others, ICON_KEEPOUT)) break
    start = randomPoint()
  }

  const points: Point[] = [start]
  for (let i = 1; i < count; i++) points.push(nextPoint(points[i - 1], others))

  for (let attempt = 0; attempt < 60; attempt++) {
    if (isSegmentSafe(points[points.length - 1], points[0])) break
    points[points.length - 1] = nextPoint(points[points.length - 2], others)
  }

  return points
}

function toPath(points: Point[]) {
  const closed = [...points, points[0]]
  return { left: closed.map((p) => `${p.x}%`), top: closed.map((p) => `${p.y}%`) }
}

export type FloatPath = ReturnType<typeof toPath>

// 아이콘 개수만큼 경로를 한 번에 만든다. 뒤에 만드는 아이콘일수록 앞서 만든 아이콘들의 경유지를
// 전부 피해서 지나가므로, 개별적으로 각자 랜덤하게 움직일 때보다 서로 덜 겹친다.
function buildAllPaths(iconCount: number, waypointsPerIcon: number): FloatPath[] {
  const allPoints: Point[] = []
  const perIconPoints: Point[][] = []
  for (let i = 0; i < iconCount; i++) {
    const points = buildWaypoints(waypointsPerIcon, allPoints)
    perIconPoints.push(points)
    allPoints.push(...points)
  }
  return perIconPoints.map(toPath)
}

// 서버 렌더와 클라이언트 첫 렌더 사이엔 항상 false(getServerSnapshot)를 반환해 하이드레이션을
// 맞추고, 마운트가 끝난 뒤에야 true(getSnapshot)로 바뀐다. 구독할 외부 값이 없어 no-op.
function subscribe() {
  return () => {}
}

function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

// Math.random()은 서버와 클라이언트 렌더 사이에 값이 달라 하이드레이션 불일치를 낸다. 그래서
// 경로는 마운트가 끝난 뒤(isClient가 true가 된 뒤) 딱 한 번만 만든다. 그 전엔 모두 null이라,
// 아래 FloatingIcon은 서버가 그렸던 것과 동일하게 children을 그대로 렌더링해 하이드레이션이
// 일치하게 된다.
export function useFloatingPaths(iconCount: number, waypointsPerIcon = 5): (FloatPath | null)[] {
  const isClient = useIsClient()
  return useMemo(
    () => (isClient ? buildAllPaths(iconCount, waypointsPerIcon) : Array(iconCount).fill(null)),
    [isClient, iconCount, waypointsPerIcon],
  )
}

export function FloatingIcon({
  children,
  path,
  /** 궤적 한 바퀴를 도는 데 걸리는 시간(초). 느리고 자연스러운 느낌을 위해 기본값을 넉넉히 잡았다. */
  duration = 40,
  delay = 0,
}: {
  children: ReactNode
  path: FloatPath | null
  duration?: number
  delay?: number
}) {
  if (!path) return <>{children}</>

  return (
    <motion.div
      className='absolute'
      style={{ translateX: '-50%', translateY: '-50%' }}
      initial={{ left: path.left[0], top: path.top[0] }}
      animate={path}
      transition={{ duration, delay, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
