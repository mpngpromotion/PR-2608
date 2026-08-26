'use client'

import { useEffect, useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'

interface UseScrubRevealOptions {
  brushSize?: number
}

/**
 * 흐림 자체는 표준 CSS `filter: blur()`를 건 <img>가 맡고(캔버스 filter보다 모바일 지원이
 * 훨씬 넓다), 이 훅은 그 흐린 레이어를 가리는 알파 마스크만 만든다. 사용자가 문지른(drag)
 * 자리만큼 캔버스에 destination-out으로 구멍을 뚫고, 그 결과를 mask-image로 내보내면
 * 흐린 레이어의 해당 부분만 사라지면서 아래 선명한 원본이 드러난다.
 */
export function useScrubReveal({ brushSize = 36 }: UseScrubRevealOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskUrlRef = useRef<string | null>(null)
  const framePendingRef = useRef(false)
  const [maskUrl, setMaskUrl] = useState<string | null>(null)

  const publishMask = (canvas: HTMLCanvasElement) => {
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      if (maskUrlRef.current) URL.revokeObjectURL(maskUrlRef.current)
      maskUrlRef.current = url
      setMaskUrl(url)
    }, 'image/png')
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = container.getBoundingClientRect()
    if (width === 0 || height === 0) return

    canvas.width = width
    canvas.height = height
    // 표준 mask-image는 기본적으로 알파가 아니라 휘도(luminance) 기준으로 마스킹한다(검은색 =
    // 휘도 0 = 완전히 가려짐). 흰색은 알파 마스크로 봐도(불투명) 휘도 마스크로 봐도(휘도 1)
    // 항상 "그대로 보임"이 되므로, 브라우저가 둘 중 어느 쪽으로 해석하든 안전하다.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    publishMask(canvas)

    return () => {
      if (maskUrlRef.current) URL.revokeObjectURL(maskUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const erase = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(clientX - rect.left, clientY - rect.top, brushSize, 0, Math.PI * 2)
    ctx.fill()

    // 포인터 이동마다 매번 마스크를 내보내면 비용이 크니, 한 프레임에 한 번만 반영한다.
    if (!framePendingRef.current) {
      framePendingRef.current = true
      requestAnimationFrame(() => {
        framePendingRef.current = false
        publishMask(canvas)
      })
    }
  }

  const bind = useDrag(({ xy: [x, y], active }) => {
    if (active) erase(x, y)
  })

  return { containerRef, canvasRef, bind, maskUrl }
}
