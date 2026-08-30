'use client'

import { motion } from 'motion/react'
import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react'

// 아이콘이 자기 부모 -container div(예: #icon-lyrics-container) 영역 안에서만 구름처럼
// 천천히 표류하는 래퍼. 이 컴포넌트가 직접 렌더링하는 relative 래퍼가 부모 -container와 같은
// 크기(w-full h-full)로 겹쳐지고, left/top(%)은 그 래퍼(= 부모의 실측 크기) 기준 아이콘
// "중심" 좌표다. 아이콘마다 자기 컨테이너를 벗어나지 않으니 다른 아이콘의 자리를 피할 필요는
// 자연히 없어지지만, 갤러리/가사 컨테이너처럼 그 안에 하단 소셜 버튼이 걸쳐 있는 경우엔
// avoidRef로 그 요소를 넘기면 그 자리만 따로 피해서 지나간다.
interface Point {
  x: number
  y: number
}

interface Zone {
  x: [number, number]
  y: [number, number]
}

interface Size {
  width: number
  height: number
}

// 컨테이너 가장자리에 아이콘이 붙지 않게 두는 여백(%). left/top이 아이콘의 "중심"이라, 이
// 여백이 아이콘 절반 크기보다 작으면 중심이 가장자리 가까이 갈 때 아이콘 절반이 컨테이너 밖으로
// 삐져나가버린다. 컨테이너가 아이콘에 비해 작으면(margin이 40%를 넘어가려 하면) 40%로 묶어서
// 움직일 공간을 최소한이라도 남겨둔다.
const MIN_MARGIN_PERCENT = 8
const MAX_MARGIN_PERCENT = 40

// 아이콘의 실측 크기(px, 가로/세로 따로)를 컨테이너 실측 크기(px) 기준 여백(%)으로 바꾼다.
// 아이콘이 정사각형이 아닐 수 있어(예: 세로로 긴 이미지) 축마다 아이콘·컨테이너 크기를 각각
// 따로 대응해서 계산한다.
function computeMargin(iconSize: Size, containerSize: Size): Zone {
  const marginX = clamp((iconSize.width / 2 / containerSize.width) * 100, MIN_MARGIN_PERCENT, MAX_MARGIN_PERCENT)
  const marginY = clamp((iconSize.height / 2 / containerSize.height) * 100, MIN_MARGIN_PERCENT, MAX_MARGIN_PERCENT)
  return { x: [marginX, 100 - marginX], y: [marginY, 100 - marginY] }
}

// 회피 영역(avoidRef로 넘긴 요소) 둘레에 추가로 남겨두는 최소한의 시각적 버퍼(%) — 아이콘
// 자체 크기로 인한 여유는 아래에서 축마다 따로 더한다.
const AVOID_PADDING_PERCENT = 2

// avoidEl(예: 소셜 버튼 묶음)의 화면상 사각형을, containerEl 기준 상대 좌표(%)로 바꾼다. left/top이
// 아이콘의 "중심"이므로, 중심이 이 zone 밖에 있어도 아이콘 절반이 avoidEl과 겹칠 수 있다 —
// 아이콘 실측 크기의 절반만큼 각 축에 더 넉넉히 부풀려서, 아이콘의 실제 테두리가 avoidEl에 닿지
// 않게 한다. containerEl과 겹치는 부분이 전혀 없으면(다른 아이콘의 컨테이너처럼 서로 무관한
// 경우) null을 반환해 회피 로직 자체를 건너뛰게 한다.
function computeAvoidZone(
  containerRect: DOMRect,
  avoidEl: HTMLElement | null | undefined,
  iconSize: Size,
): Zone | null {
  if (!avoidEl || containerRect.width === 0 || containerRect.height === 0) return null
  const avoidRect = avoidEl.getBoundingClientRect()
  const paddingXPercent = (iconSize.width / 2 / containerRect.width) * 100 + AVOID_PADDING_PERCENT
  const paddingYPercent = (iconSize.height / 2 / containerRect.height) * 100 + AVOID_PADDING_PERCENT
  const toPercent = (px: number, size: number) => (px / size) * 100
  const zone: Zone = {
    x: [
      clamp(toPercent(avoidRect.left - containerRect.left, containerRect.width) - paddingXPercent, 0, 100),
      clamp(toPercent(avoidRect.right - containerRect.left, containerRect.width) + paddingXPercent, 0, 100),
    ],
    y: [
      clamp(toPercent(avoidRect.top - containerRect.top, containerRect.height) - paddingYPercent, 0, 100),
      clamp(toPercent(avoidRect.bottom - containerRect.top, containerRect.height) + paddingYPercent, 0, 100),
    ],
  }
  return zone.x[0] < zone.x[1] && zone.y[0] < zone.y[1] ? zone : null
}

// 한 걸음에 이동할 수 있는 최대 거리(%). 컨테이너를 대각선으로 가로지르는 큰 점프 대신, 짧게
// 짧게 이어지는 걸음을 쌓아야 방향이 급격히 안 꺾이고 구름처럼 완만하게 흘러가는 느낌이 난다.
const MAX_STEP = 26

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

// v가 [min, max]를 벗어나면 벽에 부딪혀 튕겨 나온 것처럼 초과분만큼 반사시킨다. clamp처럼 벽에
// 딱 눌러 붙이면 다음 스텝이 그 지점에서 전혀 다른 랜덤 방향으로 다시 출발해 "핀에 박혔다 튀는"
// 것처럼 부자연스러워 보였다 — 반사시키면 초과한 거리만큼 안쪽으로 밀려 들어오면서 그 지점이
// 매번 달라져, Catmull-Rom 곡선이 날카로운 모서리 없이 벽 근처를 부드러운 호로 그린다.
function reflect(v: number, min: number, max: number): number {
  const range = max - min
  if (range <= 0) return min
  let t = (v - min) % (2 * range)
  if (t < 0) t += 2 * range
  return t <= range ? min + t : max - (t - range)
}

function isPointSafe(x: number, y: number, avoid: Zone | null) {
  if (!avoid) return true
  return !(x >= avoid.x[0] && x <= avoid.x[1] && y >= avoid.y[0] && y <= avoid.y[1])
}

// 두 점을 잇는 직선이 회피 영역을 가로지르지 않는지 여러 지점으로 샘플링해 확인한다.
function isSegmentSafe(a: Point, b: Point, avoid: Zone | null) {
  if (!avoid) return true
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!isPointSafe(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, avoid)) return false
  }
  return true
}

function randomPoint(margin: Zone, avoid: Zone | null): Point {
  for (let attempt = 0; attempt < 40; attempt++) {
    const p = {
      x: margin.x[0] + Math.random() * (margin.x[1] - margin.x[0]),
      y: margin.y[0] + Math.random() * (margin.y[1] - margin.y[0]),
    }
    if (isPointSafe(p.x, p.y, avoid)) return p
  }
  return { x: (margin.x[0] + margin.x[1]) / 2, y: (margin.y[0] + margin.y[1]) / 2 }
}

// from 주변의 짧은 거리 안에서 다음 경유지를 뽑는다(컨테이너를 가로지르는 큰 점프 방지). margin이
// 사각형이라 여기서 나온 점은 항상 margin 안쪽이고, avoid가 있으면 그 영역과 거기로 가는 직선
// 경로까지 피한다.
function randomStep(from: Point, margin: Zone, avoid: Zone | null): Point {
  let fallback: Point | null = null
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const dist = MAX_STEP * (0.35 + Math.random() * 0.65)
    const candidate = {
      x: reflect(from.x + Math.cos(angle) * dist, margin.x[0], margin.x[1]),
      y: reflect(from.y + Math.sin(angle) * dist, margin.y[0], margin.y[1]),
    }
    if (!fallback) fallback = candidate
    if (isPointSafe(candidate.x, candidate.y, avoid) && isSegmentSafe(from, candidate, avoid)) return candidate
  }
  // 회피 조건을 만족하는 후보를 못 찾으면(여백이 좁아 거의 다 회피 영역인 경우) margin 안이라는
  // 것만은 보장된 마지막 후보라도 반환한다.
  return fallback ?? from
}

// waypoints개 경유지를 순서대로 잇는 폐곡선을 만든다.
function buildWaypoints(count: number, margin: Zone, avoid: Zone | null): Point[] {
  const points: Point[] = [randomPoint(margin, avoid)]
  for (let i = 1; i < count; i++) points.push(randomStep(points[i - 1], margin, avoid))
  return points
}

// 경유지를 직선으로 잇지 않고 부드러운 곡선(Catmull-Rom 스플라인)으로 잇기 위한 세분화 정도.
// 값을 올릴수록 곡선이 매끄러워지지만 keyframe 개수가 늘어난다(10이면 경유지 사이가 10등분).
const SAMPLES_PER_SEGMENT = 10
// 곡선이 얼마나 크게 휘어지는지(0=직선, 1=아주 크게 휨). 너무 크면 경유지 사이에서 곡선이
// 여백 밖으로 부풀어 나갈 수 있어 적당히 낮게 잡았다.
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

// 경유지(points)를 곡선으로 잇되, 곡선이 여백이나 회피 영역을 벗어나는 지점만 그 지점의 직선
// 보간값으로 대체한다(margin·avoid 모두 사각형이라, 이미 안전하다고 확인된 두 경유지를 직선으로
// 이으면 항상 안전하게 머문다) — 대부분은 부드러운 곡선이고, 위험한 구간만 안전하게 직선으로
// 돌아간다.
function buildSmoothPath(points: Point[], margin: Zone, avoid: Zone | null): Point[] {
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
      const curvedSafe = withinZone(curved, margin) && isPointSafe(curved.x, curved.y, avoid)
      smoothed.push(curvedSafe ? curved : linear)
    }
  }
  smoothed.push(smoothed[0])
  return smoothed
}

function toKeyframes(points: Point[]) {
  return { left: points.map((p) => `${p.x}%`), top: points.map((p) => `${p.y}%`) }
}

type FloatPath = ReturnType<typeof toKeyframes>

// 경로(%) 전체 길이를 컨테이너 실측 크기 기준 px로 환산해 더한다 — 컨테이너 크기와 무관하게
// "체감 속도"를 일정하게 맞추기 위해, 초 단위 duration을 고정값이 아니라 이 길이에서 역산한다.
function pathLengthPx(points: Point[], size: Size): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = ((points[i].x - points[i - 1].x) / 100) * size.width
    const dy = ((points[i].y - points[i - 1].y) / 100) * size.height
    total += Math.hypot(dx, dy)
  }
  return total
}

// 컨테이너가 작아 경로 길이가 아주 짧아도 너무 빨라 어지럽지 않게, 반대로 아주 길어도 너무
// 늘어지지 않게 duration을 이 범위로 묶는다.
const MIN_DURATION = 6
const MAX_DURATION = 50

export function FloatingIcon({
  children,
  /** 초당 이동 속도(px) — duration을 고정하지 않고 이 속도와 실제 경로 길이로 역산해서, 컨테이너
   * 크기가 달라도 표류하는 체감 속도가 비슷하게 유지된다. */
  speedPxPerSec = 5,
  delay = 0,
  waypoints = 5,
  /** 이 아이콘의 컨테이너 안에 걸쳐 있는, 지나가면 안 되는 요소(예: 하단 소셜 버튼 묶음). */
  avoidRef,
}: {
  children: ReactNode
  speedPxPerSec?: number
  delay?: number
  waypoints?: number
  avoidRef?: RefObject<HTMLElement | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // children을 감싸는 실측용 래퍼. w-fit h-fit로 children 크기에 딱 맞춰, 아이콘 자체의 실제
  // 렌더 크기(가로/세로 모두 — 정사각형이 아닐 수 있다)를 그대로 잰다. sizePx를 손으로 맞춰줄
  // 필요 없이 항상 정확하다.
  const iconRef = useRef<HTMLDivElement>(null)
  const [measurement, setMeasurement] = useState<{ size: Size; iconSize: Size; avoidZone: Zone | null } | null>(null)

  // 부모 -container div, 아이콘 자신, (있다면) avoidRef 요소의 실측 크기·위치를 마운트 직후 한
  // 번만 잰다. 서버 렌더와 첫 클라이언트 렌더 사이엔 항상 null이라 children을 그대로(위치 이동
  // 없이) 렌더링해 하이드레이션이 일치하고, 마운트가 끝난 뒤에야 실측값 기준으로 경로가 만들어진다.
  useEffect(() => {
    const el = containerRef.current
    const iconEl = iconRef.current
    if (!el || !iconEl) return
    const containerRect = el.getBoundingClientRect()
    const iconRect = iconEl.getBoundingClientRect()
    const iconSize = { width: iconRect.width, height: iconRect.height }
    setMeasurement({
      size: { width: containerRect.width, height: containerRect.height },
      iconSize,
      avoidZone: computeAvoidZone(containerRect, avoidRef?.current, iconSize),
    })
  }, [avoidRef])

  // Math.random()은 서버와 클라이언트 렌더 사이에 값이 달라 하이드레이션 불일치를 낸다.
  // measurement가 실측되기 전(null)에는 floating도 null이라, 위 useEffect 이전 렌더는 항상
  // children을 그대로 보여준다.
  const floating = useMemo<{ path: FloatPath; duration: number } | null>(() => {
    if (!measurement || measurement.size.width === 0 || measurement.size.height === 0) return null
    const { size, iconSize, avoidZone } = measurement
    const margin = computeMargin(iconSize, size)
    const smoothed = buildSmoothPath(buildWaypoints(waypoints, margin, avoidZone), margin, avoidZone)
    const duration = clamp(pathLengthPx(smoothed, size) / speedPxPerSec, MIN_DURATION, MAX_DURATION)
    return { path: toKeyframes(smoothed), duration }
  }, [measurement, waypoints, speedPxPerSec])

  const measured = (
    <div ref={iconRef} className='inline-block'>
      {children}
    </div>
  )

  return (
    <div ref={containerRef} className='relative w-full h-full'>
      {!floating ? (
        measured
      ) : (
        <motion.div
          className='absolute'
          style={{ translateX: '-50%', translateY: '-50%' }}
          initial={{ left: floating.path.left[0], top: floating.path.top[0] }}
          animate={floating.path}
          // ease를 문자열 하나로 주면 프레이머모션이 "구간 전체"가 아니라 경유지 사이 "구간마다"
          // 똑같은 커브를 입힌다. easeInOut을 쓰면 매 경유지에 도착할 때마다 속도가 0에 가깝게
          // 줄었다가 다시 붙는데, 이게 반복되면서 "멈췄다가 랜덤하게 움직이는" 것처럼 보였다
          // (특히 처음 로드 시 첫 구간 초반 속도가 거의 0이라 한동안 안 움직이는 것처럼 보임).
          // linear로 바꾸면 각 구간 내내 일정한 속도로 흘러서 뚝뚝 끊기지 않고 계속 표류한다.
          transition={{ duration: floating.duration, delay, repeat: Infinity, repeatType: 'loop', ease: 'linear' }}
        >
          {measured}
        </motion.div>
      )}
    </div>
  )
}
