'use client'

import { useEffect, useRef } from 'react'
import { useDrag } from '@use-gesture/react'

interface UseScrubRevealOptions {
  src: string
  brushSize?: number
}

/**
 * 블러 처리된 이미지를 canvas에 그려서 위에 올려두고, 사용자가 문지른(drag) 궤적만큼
 * destination-out으로 지워서 아래의 선명한 <img>가 드러나게 한다.
 */
export function useScrubReveal({ src, brushSize = 36 }: UseScrubRevealOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => {
      const { width, height } = container.getBoundingClientRect()
      canvas.width = width
      canvas.height = height
      ctx.filter = 'blur(18px)'
      ctx.drawImage(img, 0, 0, width, height)
      ctx.filter = 'none'
    }
  }, [src])

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
  }

  const bind = useDrag(({ xy: [x, y], active }) => {
    if (active) erase(x, y)
  })

  return { containerRef, canvasRef, bind }
}
