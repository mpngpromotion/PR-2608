'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useDrag } from '@use-gesture/react'

interface UseScrubRevealOptions {
  brushSize?: number
  // 캔버스의 "문지르기 판정 영역"을 실제 사진 크기보다 사방으로 이만큼(px) 더 넓게 잡는다.
  // Swiper의 noSwipingSelector='canvas'가 이 확장된 영역까지 그대로 적용되므로, 카드 여백에서
  // 시작한 드래그도 스와이프 대신 문지르기로 인식되는 비율이 늘고, 반대로 슬라이드 넘기기용으로
  // 남는 여백은 그만큼 줄어든다. 마스크/블러 표시 크기 자체는 바뀌지 않는다(캔버스 해상도는
  // 그대로 사진 크기 기준).
  hitPadding?: number
  // 마스크에서 이 비율(0~1) 이상이 지워지면 onSufficientlyRevealed를 한 번만 호출한다.
  revealedThreshold?: number
  // "이미 어느 정도 봤다"고 볼 수 있는 시점(위 threshold를 넘는 순간)에 딱 한 번 호출된다.
  // 예: 이미 충분히 드러난 사진에는 문지르라는 안내를 더 이상 띄우지 않는 용도.
  onSufficientlyRevealed?: () => void
}

/**
 * 흐림 자체는 표준 CSS `filter: blur()`를 건 <img>가 맡고(캔버스 filter보다 모바일 지원이
 * 훨씬 넓다), 이 훅은 그 흐린 레이어를 가리는 알파 마스크만 만든다. 사용자가 문지른(drag)
 * 자리만큼 캔버스에 destination-out으로 구멍을 뚫고, 그 결과를 mask-image로 내보내면
 * 흐린 레이어의 해당 부분만 사라지면서 아래 선명한 원본이 드러난다.
 */
export function useScrubReveal({
  brushSize = 36,
  hitPadding = 20,
  revealedThreshold = 0.1,
  onSufficientlyRevealed,
}: UseScrubRevealOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framePendingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const revealedNotifiedRef = useRef(false)
  const [maskUrl, setMaskUrl] = useState<string | null>(null)

  // toBlob()+Object URL은 비동기라, "새 URL을 만들고 헌 URL을 지운다" 사이에 브라우저가 새
  // blob URL을 아직 디코드하지 못한 순간이 생긴다. 그 틈에 mask-image가 잠깐 유효한 소스가
  // 없는 상태가 되면서 마스크가 통째로 사라져(=블러가 다시 꽉 차 보여) 깜빡였다. toDataURL()은
  // 동기라 이 틈 자체가 없고, 지워줄 URL도 없어서 revoke 타이밍 문제도 같이 사라진다.
  const publishMask = (canvas: HTMLCanvasElement) => {
    setMaskUrl(canvas.toDataURL('image/png'))
    checkRevealedThreshold(canvas)
  }

  // 마스크의 알파 채널을 성기게 샘플링해서 "지워진 비율"을 대략 구한다. threshold를 한 번
  // 넘고 나면 다시는 검사하지 않으므로(revealedNotifiedRef), 매 프레임 비용 걱정 없이 정확한
  // getImageData를 써도 된다 — 드래그 도중 최대 한 번만 발생하는 비용이다.
  const checkRevealedThreshold = (canvas: HTMLCanvasElement) => {
    if (!onSufficientlyRevealed || revealedNotifiedRef.current) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    if (!ctx || width === 0 || height === 0) return

    const STRIDE = 4
    const data = ctx.getImageData(0, 0, width, height).data
    let sampled = 0
    let erased = 0
    for (let y = 0; y < height; y += STRIDE) {
      for (let x = 0; x < width; x += STRIDE) {
        sampled++
        if (data[(y * width + x) * 4 + 3] < 128) erased++
      }
    }
    if (sampled > 0 && erased / sampled >= revealedThreshold) {
      revealedNotifiedRef.current = true
      onSufficientlyRevealed()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // getBoundingClientRect()는 회전(rotate) 같은 CSS transform이 걸린 조상이 있으면 화면에
    // 투영된 축 정렬 바운딩 박스를 돌려줘서 실제 로컬 크기보다 커진다(카드에 rotate가 걸려있음,
    // GalleryItem 참고). offsetWidth/offsetHeight는 transform의 영향을 받지 않는 레이아웃
    // 박스 크기라 캔버스 해상도를 여기에 맞춰야 좌표 계산이 어긋나지 않는다.
    const { offsetWidth: width, offsetHeight: height } = container
    if (width === 0 || height === 0) return

    canvas.width = width
    canvas.height = height
    // 표준 mask-image는 기본적으로 알파가 아니라 휘도(luminance) 기준으로 마스킹한다(검은색 =
    // 휘도 0 = 완전히 가려짐). 흰색은 알파 마스크로 봐도(불투명) 휘도 마스크로 봐도(휘도 1)
    // 항상 "그대로 보임"이 되므로, 브라우저가 둘 중 어느 쪽으로 해석하든 안전하다.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    // 방금 새하얗게 채운 캔버스는 지워진 비율이 항상 0이라 revealedThreshold를 절대 넘을 수
    // 없으므로, checkRevealedThreshold까지 도는 publishMask 대신 마스크만 바로 내보낸다
    // (안 그러면 마운트 이펙트가 checkRevealedThreshold가 참조하는 props에 의존하게 돼서
    // exhaustive-deps가 걸린다).
    setMaskUrl(canvas.toDataURL('image/png'))
  }, [])

  // offsetX/offsetY는 이벤트 target(캔버스)의 로컬 padding box 기준 좌표라, 조상에 걸린
  // rotate 등 CSS transform을 브라우저가 알아서 역변환해서 넘겨준다(clientX/Y - rect.left/top
  // 방식은 회전된 요소에서 getBoundingClientRect()가 축 정렬 바운딩 박스를 돌려주기 때문에
  // 어긋난다). 캔버스는 히트 영역 확장을 위해 CSS 박스 자체를 실제 해상도(canvas.width/height)
  // 보다 크게 그리므로(hitPadding), offsetX/Y를 canvas.width/offsetWidth 비율로 스케일링해서
  // 실제 드로잉 좌표로 변환한다.
  const erase = (offsetX: number, offsetY: number, isFirstPoint: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return

    const x = offsetX * (canvas.width / canvas.offsetWidth)
    const y = offsetY * (canvas.height / canvas.offsetHeight)

    ctx.globalCompositeOperation = 'destination-out'

    // 빠르게 문지르면 pointermove 사이 이동 거리가 브러시 반경보다 커져서 점(arc)만 찍으면
    // 지워진 자리가 계단처럼 끊겨 보인다. 직전 점과 선으로 이어 채워서 끊김을 없앤다.
    if (!isFirstPoint && lastPointRef.current) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = brushSize * 2
      ctx.beginPath()
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(x, y, brushSize, 0, Math.PI * 2)
    ctx.fill()

    lastPointRef.current = { x, y }

    // 포인터 이동마다 매번 마스크를 내보내면 비용이 크니, 한 프레임에 한 번만 반영한다.
    if (!framePendingRef.current) {
      framePendingRef.current = true
      requestAnimationFrame(() => {
        framePendingRef.current = false
        publishMask(canvas)
      })
    }
  }

  const bind = useDrag(({ active, first, event }) => {
    if (!active) {
      lastPointRef.current = null
      return
    }
    // bind()가 React 엘리먼트에 스프레드되므로 이 event는 리액트 SyntheticEvent다. React의
    // 합성 이벤트는 offsetX/offsetY를 정규화 대상에서 빼놓고 아예 프록시하지 않아서(항상
    // undefined) event.offsetX로 바로 읽으면 안 되고, 감싸인 진짜 네이티브 이벤트
    // (nativeEvent)에서 읽어야 한다.
    const nativeEvent = (event as unknown as ReactPointerEvent).nativeEvent ?? (event as PointerEvent)
    erase(nativeEvent.offsetX, nativeEvent.offsetY, first)
  })

  return { containerRef, canvasRef, bind, maskUrl, hitPadding }
}
