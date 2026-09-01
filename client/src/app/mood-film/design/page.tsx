'use client'

import { useEffect, useRef, useState } from 'react'

import { MOOD_FILM_DURATION, MOOD_FILM_LAYER_START_TIMES, drawFrame, prepareTypographyOverlay } from '@/components/create/lib/video/moodFilmVideo'

const WIDTH = 1080
const HEIGHT = 1440

// 실제 사진 대신 흰색 12장을 만들어 쓴다 (디자인 확인용이라 사진 내용은 안 중요함) —
// 사진 자체는 안 보이고 테두리 선과 타이포그래피만 도드라져 보인다.
const PLACEHOLDER_COLORS = Array<string>(12).fill('#ffffff')

function createPlaceholderImage(color: string): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = canvas.toDataURL()
  })
}

// 무드필름 영상의 타이포그래피/사진 테두리를 코드 수정하면서 바로 확인하기 위한 디자인 전용
// 페이지. 실제 export 로직(drawFrame)을 그대로 재사용하므로 여기서 맞으면 실제 영상도 똑같이
// 나온다. 유저가 실제로 들어올 페이지가 아니라 직접 URL로 접근하는 개발용 도구다.
export default function MoodFilmDesignPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [images, setImages] = useState<HTMLImageElement[] | null>(null)
  const [typographyOverlay, setTypographyOverlay] = useState<HTMLImageElement | null>(null)
  const [color, setColor] = useState('#979797')
  const [time, setTime] = useState(MOOD_FILM_DURATION)

  useEffect(() => {
    Promise.all(PLACEHOLDER_COLORS.map(createPlaceholderImage)).then(setImages)
  }, [])

  // 타이포그래피 SVG는 색이 그 안에 칠해져 있어서, 컬러가 바뀔 때마다 다시 물들여야 한다.
  useEffect(() => {
    prepareTypographyOverlay(color).then(setTypographyOverlay)
  }, [color])

  useEffect(() => {
    if (!images || !typographyOverlay) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawFrame(ctx, images, time, WIDTH, HEIGHT, color, typographyOverlay)
  }, [images, typographyOverlay, color, time])

  return (
    <div className='flex min-h-dvh flex-col items-center gap-4 bg-neutral-900 p-4 text-white'>
      <h1 className='text-lg'>무드필름 디자인 미리보기</h1>

      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className='aspect-3/4 w-full max-w-sm border border-white/20 bg-white' />

      <div className='flex w-full max-w-sm flex-col gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          테두리 · 텍스트 컬러
          <input type='color' value={color} onChange={(event) => setColor(event.target.value)} className='h-8 w-8 cursor-pointer rounded border border-white/40 bg-transparent p-0' />
        </label>

        <label className='flex flex-col gap-1 text-sm'>
          시점: {time.toFixed(2)}초 / {MOOD_FILM_DURATION.toFixed(2)}초
          <input
            type='range'
            min={0}
            max={MOOD_FILM_DURATION}
            step={0.01}
            value={time}
            onChange={(event) => setTime(Number(event.target.value))}
          />
        </label>

        <div className='flex flex-wrap gap-2'>
          {MOOD_FILM_LAYER_START_TIMES.map((start, index) => (
            <button
              key={start}
              type='button'
              onClick={() => setTime(start)}
              className='rounded border border-white/40 px-2 py-1 text-xs hover:bg-white/10'
            >
              {index + 1}장 등장
            </button>
          ))}
          <button type='button' onClick={() => setTime(MOOD_FILM_DURATION)} className='rounded border border-white/40 px-2 py-1 text-xs hover:bg-white/10'>
            전부 다
          </button>
        </div>
      </div>
    </div>
  )
}
