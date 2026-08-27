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

// 화면 가장자리에 아이콘이 붙지 않게 두는 여백. left/top이 아이콘의 "중심"이라, 이 여백이 아이콘
// 절반 크기보다 작으면 중심이 가장자리 가까이 갈 때 아이콘 절반이 화면 밖으로 나가버린다.
// 아이콘 크기를 몰랐을 때 쓰던 기본값(사이즈 정보가 없을 때만 폴백으로 남겨둔다).
const SCREEN_MARGIN: Zone = { x: [8, 92], y: [8, 92] }
// 실제로 화면 밖을 벗어나지 않게, 여백을 최소/최대 이 범위 안으로 제한한다.
const MIN_MARGIN_PERCENT = 8
const MAX_MARGIN_PERCENT = 40

// 아이콘 한 변의 대략적인 크기(px)를 받아, 그 절반이 화면 밖으로 나가지 않을 여백(%)을 뷰포트
// 크기 기준으로 계산한다. 가로/세로 뷰포트 크기가 다르므로 축마다 따로 계산한다.
function computeMargin(iconSizePx: number): Zone {
  if (typeof window === 'undefined') return SCREEN_MARGIN
  const half = iconSizePx / 2
  const marginX = clamp((half / window.innerWidth) * 100, MIN_MARGIN_PERCENT, MAX_MARGIN_PERCENT)
  const marginY = clamp((half / window.innerHeight) * 100, MIN_MARGIN_PERCENT, MAX_MARGIN_PERCENT)
  return { x: [marginX, 100 - marginX], y: [marginY, 100 - marginY] }
}

// 겹치면 안 되는 두 영역. 실제 그리드 비율(앨범 =~ 화면 폭 50%, 중앙 정사각형 / 소셜 = 하단 줄 가운데)에
// 여유를 더한 근사치라, 정확한 픽셀 대신 넉넉한 비율로 잡았다.
const AVOID_ZONES: Zone[] = [
  { x: [18, 82], y: [28, 72] }, // 앨범 커버가 놓이는 중앙 정사각형 자리
  { x: [22, 78], y: [76, 100] }, // 소셜 버튼이 있는 하단 줄
]

// 한 걸음에 이동할 수 있는 최대 거리(%). 화면을 대각선으로 가로지르는 큰 점프 대신, 짧게 짧게
// 이어지는 걸음을 쌓아야 방향이 급격히 안 꺾이고 구름처럼 완만하게 흘러가는 느낌이 난다.
const MAX_STEP = 26
// 다른 아이콘의 경유지와 이 거리(%) 밑으로는 가까워지지 않도록 한다. 아이콘마다 아래 QUADRANTS로
// 활동 구역 자체를 나눠서 서로 겹칠 일이 크게 줄었으니, 경계선 근처에서만 살짝 떨어뜨리는
// 정도로 충분하다(값이 크면 구역이 좁아졌을 때 후보를 못 찾아 제자리에 머무는 경우가 늘어난다).
const ICON_KEEPOUT = 12

// 화면을 4분면으로 나눠 아이콘마다 자기 구역 안에서만 떠다니게 한다 — 다 같이 완전 자유롭게
// 랜덤으로 움직이면 우연히 다 한쪽에 몰릴 수 있는데, 구역을 나누면 화면 전체가 항상 골고루
// 채워져 보인다. 각 아이콘을 실제 배치(앨범=좌상, 무드필름=우상, 갤러리=좌하, 가사=우하)와
// 맞는 구역에 둬서 "자기 자리 주변에서 떠다니는" 느낌도 자연스럽게 난다.
export const QUADRANTS = {
  topLeft: { x: [0, 50], y: [0, 50] } as Zone,
  topRight: { x: [50, 100], y: [0, 50] } as Zone,
  bottomLeft: { x: [0, 50], y: [50, 100] } as Zone,
  bottomRight: { x: [50, 100], y: [50, 100] } as Zone,
}

function intersectZone(a: Zone, b: Zone): Zone {
  return {
    x: [Math.max(a.x[0], b.x[0]), Math.min(a.x[1], b.x[1])],
    y: [Math.max(a.y[0], b.y[0]), Math.min(a.y[1], b.y[1])],
  }
}

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

function randomPoint(margin: Zone): Point {
  return {
    x: margin.x[0] + Math.random() * (margin.x[1] - margin.x[0]),
    y: margin.y[0] + Math.random() * (margin.y[1] - margin.y[0]),
  }
}

// from 주변의 짧은 거리 안에서 다음 후보 지점을 뽑는다(화면을 가로지르는 큰 점프 방지).
function randomStep(from: Point, margin: Zone): Point {
  const angle = Math.random() * Math.PI * 2
  const dist = MAX_STEP * (0.35 + Math.random() * 0.65)
  return {
    x: clamp(from.x + Math.cos(angle) * dist, margin.x[0], margin.x[1]),
    y: clamp(from.y + Math.sin(angle) * dist, margin.y[0], margin.y[1]),
  }
}

// from에서 출발해, 회피 영역을 가로지르지 않고 다른 아이콘의 경유지들과도 거리를 두는 다음
// 지점을 찾는다. 그런 지점을 못 찾으면(다른 아이콘과의 거리 조건만) 완화해서 재시도한다 —
// 서로 겹치지 않는 건 "가능하면"이고, 회피 영역을 가로지르지 않는 건 항상 지켜야 하기 때문.
function nextPoint(from: Point, others: Point[], margin: Zone) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = randomStep(from, margin)
    if (isPointSafe(candidate.x, candidate.y) && isSegmentSafe(from, candidate) && isFarFromOthers(candidate, others, ICON_KEEPOUT)) {
      return candidate
    }
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = randomStep(from, margin)
    if (isPointSafe(candidate.x, candidate.y) && isSegmentSafe(from, candidate)) return candidate
  }
  return from // 정말 못 찾으면 제자리에 머무른다(경로를 가로지르는 것보단 낫다).
}

// waypoints개 지점을 순서대로 잇는 폐곡선 경로를 만든다. others에는 이미 만들어둔 다른 아이콘들의
// 경유지를 모두 넘겨, 그 지점들과 최대한 거리를 두고 지나가게 한다. margin은 이 아이콘 크기 기준으로
// 계산된 여백이라, 아이콘마다 다를 수 있다(큰 아이콘일수록 중심이 가장자리에서 더 떨어져야 한다).
function buildWaypoints(count: number, others: Point[], margin: Zone) {
  let start = randomPoint(margin)
  for (let guard = 0; guard < 100; guard++) {
    if (isPointSafe(start.x, start.y) && isFarFromOthers(start, others, ICON_KEEPOUT)) break
    start = randomPoint(margin)
  }

  const points: Point[] = [start]
  for (let i = 1; i < count; i++) points.push(nextPoint(points[i - 1], others, margin))

  for (let attempt = 0; attempt < 60; attempt++) {
    if (isSegmentSafe(points[points.length - 1], points[0])) break
    points[points.length - 1] = nextPoint(points[points.length - 2], others, margin)
  }

  return points
}

// 경유지를 직선으로 잇지 않고 부드러운 곡선(Catmull-Rom 스플라인)으로 잇기 위한 세분화 정도.
// 값을 올릴수록 곡선이 매끄러워지지만 keyframe 개수가 늘어난다(10이면 경유지 사이가 10등분).
const SAMPLES_PER_SEGMENT = 10
// 곡선이 얼마나 크게 휘어지는지(0=직선, 1=아주 크게 휨). 너무 크면 경유지 사이에서 곡선이
// 안전 영역(여백/회피 구역) 밖으로 부풀어 나갈 수 있어 적당히 낮게 잡았다.
const SPLINE_TENSION = 0.5

// Catmull-Rom(Hermite 형태) 스플라인: p1→p2 구간을 앞뒤 점(p0, p3)의 방향까지 참고해 부드럽게 잇는다.
function catmullRomPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  const m1x = (p2.x - p0.x) * SPLINE_TENSION
  const m1y = (p2.y - p0.y) * SPLINE_TENSION
  const m2x = (p3.x - p1.x) * SPLINE_TENSION
  const m2y = (p3.y - p1.y) * SPLINE_TENSION
  return {
    x: h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
    y: h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
  }
}

function withinZone(p: Point, zone: Zone) {
  return p.x >= zone.x[0] && p.x <= zone.x[1] && p.y >= zone.y[0] && p.y <= zone.y[1]
}

// 경유지(points)를 곡선으로 잇되, 곡선이 화면 여백이나 회피 구역을 벗어나는 지점만 그 지점의
// 직선 보간값으로 대체한다 — 대부분은 부드러운 곡선이고, 위험한 구간만 안전하게 직선으로 돌아간다.
function buildSmoothPath(points: Point[], margin: Zone): Point[] {
  const n = points.length
  const smoothed: Point[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      const t = s / SAMPLES_PER_SEGMENT
      const curved = catmullRomPoint(p0, p1, p2, p3, t)
      const linear = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
      smoothed.push(withinZone(curved, margin) && isPointSafe(curved.x, curved.y) ? curved : linear)
    }
  }
  smoothed.push(smoothed[0])
  return smoothed
}

function toPath(points: Point[], margin: Zone) {
  const smoothed = buildSmoothPath(points, margin)
  return { left: smoothed.map((p) => `${p.x}%`), top: smoothed.map((p) => `${p.y}%`) }
}

export type FloatPath = ReturnType<typeof toPath>

export interface FloatingIconSpec {
  /** 아이콘의 대략적인 한 변 크기(px) — 클수록 화면 가장자리에서 더 떨어진 채로 움직인다. */
  sizePx: number
  /** 이 아이콘이 떠다닐 구역. 생략하면 화면 전체(다른 아이콘/회피 구역 제약만 적용)를 쓴다. */
  region?: Zone
}

// 아이콘 개수만큼 경로를 한 번에 만든다. region이 있으면 그 구역 안으로, 없으면 화면 전체
// 안에서 만든다. 뒤에 만드는 아이콘일수록 앞서 만든 아이콘들의 경유지를 전부 피해서 지나가므로,
// 개별적으로 각자 랜덤하게 움직일 때보다 서로 덜 겹친다.
function buildAllPaths(icons: FloatingIconSpec[], waypointsPerIcon: number): FloatPath[] {
  const allPoints: Point[] = []
  const perIconPoints: Point[][] = []
  const margins: Zone[] = []
  for (let i = 0; i < icons.length; i++) {
    const { sizePx, region } = icons[i]
    const sizeMargin = computeMargin(sizePx)
    const margin = region ? intersectZone(sizeMargin, region) : sizeMargin
    const points = buildWaypoints(waypointsPerIcon, allPoints, margin)
    perIconPoints.push(points)
    margins.push(margin)
    allPoints.push(...points)
  }
  return perIconPoints.map((points, i) => toPath(points, margins[i]))
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
// icons: 각 아이콘의 실제 렌더 크기(px)와, 원하면 떠다닐 구역(QUADRANTS 등)을 순서대로 넘긴다.
export function useFloatingPaths(icons: FloatingIconSpec[], waypointsPerIcon = 5): (FloatPath | null)[] {
  const isClient = useIsClient()
  const iconsKey = icons.map((icon) => `${icon.sizePx}:${icon.region ? JSON.stringify(icon.region) : ''}`).join(',')
  return useMemo(
    () => (isClient ? buildAllPaths(icons, waypointsPerIcon) : Array(icons.length).fill(null)),
    // iconsKey만 보고 재계산 여부를 판단한다 — icons 배열을 매 렌더 새로 만들어 넘겨도(예: 인라인
    // 리터럴) 내용이 같으면 랜덤 경로를 다시 뽑지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClient, iconsKey, waypointsPerIcon],
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
      // ease를 문자열 하나로 주면 프레이머모션이 "구간 전체"가 아니라 경유지 사이 "구간마다"
      // 똑같은 커브를 입힌다. easeInOut을 쓰면 매 경유지에 도착할 때마다 속도가 0에 가깝게
      // 줄었다가 다시 붙는데, 이게 반복되면서 "멈췄다가 랜덤하게 움직이는" 것처럼 보였다
      // (특히 처음 로드 시 첫 구간 초반 속도가 거의 0이라 한동안 안 움직이는 것처럼 보임).
      // linear로 바꾸면 각 구간 내내 일정한 속도로 흘러서 뚝뚝 끊기지 않고 계속 표류한다.
      transition={{ duration, delay, repeat: Infinity, repeatType: 'loop', ease: 'linear' }}
    >
      {children}
    </motion.div>
  )
}
