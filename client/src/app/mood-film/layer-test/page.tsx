'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  MOOD_FILM_DURATION,
  MOOD_FILM_FPS,
  MOOD_FILM_LAYERS,
  type MoodFilmLayer,
  drawFrame,
  ensureTypographyFontLoaded,
} from '@/components/create/lib/video/moodFilmVideo'

const WIDTH = 1080
const HEIGHT = 1440
const MAX_FRAME = Math.round(MOOD_FILM_DURATION * MOOD_FILM_FPS)
const LAYER_COUNT = MOOD_FILM_LAYERS.length

type LayerState = { start: number; rotation: number; x: number; y: number }

function toLayerState(layer: MoodFilmLayer): LayerState {
  return { start: layer.start, rotation: layer.rotation, x: layer.x, y: layer.y }
}

// 사진을 아직 안 올린 슬롯도 몇 번 레이어인지 구분되게, 색이 다르고 큰 숫자가 박힌 자리표시자를 만든다.
function createPlaceholderImage(index: number): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = `hsl(${(index * 360) / LAYER_COUNT}, 45%, 35%)`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 180px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(index + 1), canvas.width / 2, canvas.height / 2)
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = canvas.toDataURL()
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(8)))
}

function buildCodeSnippet(states: LayerState[]) {
  const lines = states.map(
    (l) => `  { start: ${l.start}, rotation: ${formatNumber(l.rotation)}, x: ${formatNumber(l.x)}, y: ${formatNumber(l.y)} },`,
  )
  return `[\n${lines.join('\n')}\n]`
}

// Premiere XML 좌표(무드필름 레이어 위치/회전/등장 프레임)를 실제 사진을 올려두고 프레임 단위로
// 넘겨가며 손으로 맞춰보기 위한 개발용 도구. 실제 export 경로(drawFrame)를 그대로 재사용하므로
// 여기서 맞춘 값이 실제 영상 결과와 100% 동일하다. 유저가 실제로 들어오는 페이지가 아니라 직접
// URL로 접근하는 개발용 도구다.
type OverlayFile = { url: string; type: 'video' | 'image' }

export default function MoodFilmLayerTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayVideoRef = useRef<HTMLVideoElement>(null)

  const [placeholders, setPlaceholders] = useState<HTMLImageElement[] | null>(null)
  const [uploadedImages, setUploadedImages] = useState<(HTMLImageElement | null)[]>(() => Array(LAYER_COUNT).fill(null))
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>(() => Array(LAYER_COUNT).fill(null))

  const [fontReady, setFontReady] = useState(false)
  const [color, setColor] = useState('#979797')
  const [frame, setFrame] = useState(0)

  const [layerStates, setLayerStates] = useState<LayerState[]>(() => MOOD_FILM_LAYERS.map(toLayerState))

  const [overlayFile, setOverlayFile] = useState<OverlayFile | null>(null)
  const [overlayOpacity, setOverlayOpacity] = useState(50)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')

  useEffect(() => {
    Promise.all(Array.from({ length: LAYER_COUNT }, (_, i) => createPlaceholderImage(i))).then(setPlaceholders)
    ensureTypographyFontLoaded().then(() => setFontReady(true))
  }, [])

  // 슬롯별 파일 input이 새 object URL을 만들면 예전 것은 정리한다.
  useEffect(() => {
    return () => {
      photoUrls.forEach((url) => url && URL.revokeObjectURL(url))
      if (overlayFile) URL.revokeObjectURL(overlayFile.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setFrame((f) => clamp(f - 1, 0, MAX_FRAME))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setFrame((f) => clamp(f + 1, 0, MAX_FRAME))
      } else if (event.code === 'Space') {
        event.preventDefault()
        setSpaceHeld(true)
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const images = useMemo(() => {
    if (!placeholders) return null
    return placeholders.map((placeholder, i) => uploadedImages[i] ?? placeholder)
  }, [placeholders, uploadedImages])

  const drawLayers = useMemo(
    () => layerStates.map((l) => ({ ...l, startSec: l.start / MOOD_FILM_FPS })),
    [layerStates],
  )

  const time = frame / MOOD_FILM_FPS

  useEffect(() => {
    if (!images || !fontReady) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawFrame(ctx, images, time, WIDTH, HEIGHT, color, drawLayers)
  }, [images, fontReady, color, time, drawLayers])

  // 참조 영상이 있으면 캔버스 스크러빙 시간에 맞춰 같은 지점으로 seek해서 겹쳐 보이게 한다.
  useEffect(() => {
    const video = overlayVideoRef.current
    if (!video || overlayFile?.type !== 'video') return
    if (Math.abs(video.currentTime - time) > 1 / MOOD_FILM_FPS / 2) {
      video.currentTime = time
    }
  }, [time, overlayFile])

  function handleSlotFile(index: number, file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)

    setPhotoUrls((prev) => {
      const next = [...prev]
      const old = next[index]
      next[index] = url
      if (old) URL.revokeObjectURL(old)
      return next
    })

    const img = new Image()
    img.onload = () => {
      setUploadedImages((prev) => {
        const next = [...prev]
        next[index] = img
        return next
      })
    }
    img.src = url
  }

  function clearSlot(index: number) {
    setPhotoUrls((prev) => {
      const next = [...prev]
      const old = next[index]
      next[index] = null
      if (old) URL.revokeObjectURL(old)
      return next
    })
    setUploadedImages((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }

  function updateLayer(index: number, patch: Partial<LayerState>) {
    setLayerStates((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  function resetLayers() {
    setLayerStates(MOOD_FILM_LAYERS.map(toLayerState))
  }

  async function copyCode() {
    const snippet = buildCodeSnippet(layerStates)
    try {
      await navigator.clipboard.writeText(snippet)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 1500)
    } catch {
      // 클립보드 권한이 없으면 아래 textarea에서 직접 긁어가면 된다.
    }
  }

  function handleOverlayFile(file: File | undefined) {
    if (!file) return
    if (overlayFile) URL.revokeObjectURL(overlayFile.url)
    const type: OverlayFile['type'] = file.type.startsWith('video/') ? 'video' : 'image'
    setOverlayFile({ url: URL.createObjectURL(file), type })
  }

  const visibleLayerNumbers = layerStates
    .map((l, i) => ({ start: l.start, number: i + 1 }))
    .filter((l) => l.start <= frame)
    .map((l) => l.number)

  const codeSnippet = useMemo(() => buildCodeSnippet(layerStates), [layerStates])

  return (
    <div className='flex min-h-dvh flex-col gap-6 bg-neutral-900 p-4 text-white lg:flex-row lg:items-start'>
      <div className='flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:w-[420px] lg:shrink-0'>
        <h1 className='text-lg'>무드필름 레이어 테스트 (프레임 단위)</h1>

        <div className='relative aspect-3/4 w-full max-w-sm'>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className='h-full w-full border border-white/20 bg-white' />
          {overlayFile?.type === 'video' && (
            <video
              ref={overlayVideoRef}
              src={overlayFile.url}
              muted
              playsInline
              onLoadedMetadata={() => {
                if (overlayVideoRef.current) overlayVideoRef.current.currentTime = time
              }}
              className='pointer-events-none absolute inset-0 h-full w-full'
              style={{ opacity: spaceHeld ? 0 : overlayOpacity / 100 }}
            />
          )}
          {overlayFile?.type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={overlayFile.url}
              alt='참조 프레임'
              className='pointer-events-none absolute inset-0 h-full w-full'
              style={{ opacity: spaceHeld ? 0 : overlayOpacity / 100 }}
            />
          )}
        </div>

        <div className='flex w-full max-w-sm flex-col gap-3'>
          <label className='flex items-center gap-2 text-sm'>
            테두리 · 텍스트 컬러
            <input type='color' value={color} onChange={(e) => setColor(e.target.value)} className='h-8 w-8 cursor-pointer rounded border border-white/40 bg-transparent p-0' />
          </label>

          <div className='flex flex-col gap-1 text-sm'>
            <div className='flex items-center justify-between'>
              <span>
                프레임 {frame} / {MAX_FRAME} ({time.toFixed(2)}초)
              </span>
              <div className='flex gap-1'>
                <button type='button' onClick={() => setFrame((f) => clamp(f - 1, 0, MAX_FRAME))} className='rounded border border-white/40 px-2 py-0.5 hover:bg-white/10'>
                  ◀ 이전
                </button>
                <button type='button' onClick={() => setFrame((f) => clamp(f + 1, 0, MAX_FRAME))} className='rounded border border-white/40 px-2 py-0.5 hover:bg-white/10'>
                  다음 ▶
                </button>
              </div>
            </div>
            <input type='range' min={0} max={MAX_FRAME} step={1} value={frame} onChange={(e) => setFrame(Number(e.target.value))} />
            <input
              type='number'
              min={0}
              max={MAX_FRAME}
              value={frame}
              onChange={(e) => setFrame(clamp(Number(e.target.value) || 0, 0, MAX_FRAME))}
              className='w-24 rounded border border-white/40 bg-transparent px-2 py-1'
            />
            <span className='text-xs text-white/50'>← → 방향키로 한 프레임씩 이동</span>
          </div>

          <div className='flex flex-wrap gap-2'>
            {layerStates.map((l, i) => (
              <button key={i} type='button' onClick={() => setFrame(clamp(l.start, 0, MAX_FRAME))} className='rounded border border-white/40 px-2 py-1 text-xs hover:bg-white/10'>
                {i + 1}번 등장
              </button>
            ))}
          </div>

          <p className='text-xs text-white/50'>현재 프레임에 보이는 사진: {visibleLayerNumbers.join(', ') || '없음'}</p>

          <div className='flex flex-col gap-1 border-t border-white/10 pt-3 text-sm'>
            <span>원본 영상 오버레이 (프리미어에서 뽑은 mp4나 캡처 이미지를 올리면, 위 프레임 스크러버와 같은 시간으로 자동 seek되면서 겹쳐 보여줌)</span>
            <input type='file' accept='video/*,image/*' onChange={(e) => handleOverlayFile(e.target.files?.[0])} className='text-xs' />
            {overlayFile && (
              <div className='flex items-center gap-2'>
                <input type='range' min={0} max={100} value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))} className='flex-1' />
                <span className='w-10 text-xs'>{overlayOpacity}%</span>
                <button
                  type='button'
                  onClick={() => {
                    URL.revokeObjectURL(overlayFile.url)
                    setOverlayFile(null)
                  }}
                  className='rounded border border-white/40 px-2 py-0.5 text-xs hover:bg-white/10'
                >
                  제거
                </button>
              </div>
            )}
            {overlayFile && <span className='text-xs text-white/50'>스페이스바를 누르고 있으면 오버레이가 잠깐 숨겨짐 (blink 비교)</span>}
          </div>
        </div>
      </div>

      <div className='flex flex-1 flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm text-white/70'>레이어 12장 (사진 · 등장 프레임 · x · y · 회전)</h2>
          <div className='flex gap-2'>
            <button type='button' onClick={resetLayers} className='rounded border border-white/40 px-2 py-1 text-xs hover:bg-white/10'>
              원본값으로 초기화
            </button>
            <button type='button' onClick={copyCode} className='rounded border border-white/40 px-2 py-1 text-xs hover:bg-white/10'>
              {copyStatus === 'copied' ? '복사됨!' : '코드로 복사'}
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3'>
          {layerStates.map((layer, i) => (
            <div key={i} className='flex flex-col gap-2 rounded border border-white/15 p-3'>
              <div className='flex items-center gap-2'>
                <span className='w-5 text-sm font-semibold'>{i + 1}</span>
                <input type='file' accept='image/*' onChange={(e) => handleSlotFile(i, e.target.files?.[0])} className='min-w-0 flex-1 text-xs' />
                {photoUrls[i] && (
                  <button type='button' onClick={() => clearSlot(i)} className='shrink-0 rounded border border-white/40 px-1.5 py-0.5 text-xs hover:bg-white/10'>
                    x
                  </button>
                )}
              </div>

              <label className='flex items-center justify-between gap-2 text-xs'>
                등장 프레임
                <input
                  type='number'
                  value={layer.start}
                  min={0}
                  max={MAX_FRAME}
                  onChange={(e) => updateLayer(i, { start: clamp(Number(e.target.value) || 0, 0, MAX_FRAME) })}
                  className='w-20 rounded border border-white/40 bg-transparent px-1.5 py-1 text-right'
                />
              </label>

              <label className='flex items-center justify-between gap-2 text-xs'>
                회전(deg)
                <input
                  type='number'
                  value={layer.rotation}
                  step={0.5}
                  onChange={(e) => updateLayer(i, { rotation: Number(e.target.value) || 0 })}
                  className='w-20 rounded border border-white/40 bg-transparent px-1.5 py-1 text-right'
                />
              </label>

              <label className='flex items-center justify-between gap-2 text-xs'>
                x (가로폭 비율)
                <input
                  type='number'
                  value={layer.x}
                  step={0.0005}
                  onChange={(e) => updateLayer(i, { x: Number(e.target.value) || 0 })}
                  className='w-20 rounded border border-white/40 bg-transparent px-1.5 py-1 text-right'
                />
              </label>

              <label className='flex items-center justify-between gap-2 text-xs'>
                y (세로높이 비율)
                <input
                  type='number'
                  value={layer.y}
                  step={0.0005}
                  onChange={(e) => updateLayer(i, { y: Number(e.target.value) || 0 })}
                  className='w-20 rounded border border-white/40 bg-transparent px-1.5 py-1 text-right'
                />
              </label>
            </div>
          ))}
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-sm text-white/70'>moodFilmVideo.ts의 layers 배열에 그대로 붙여넣을 코드</span>
          <textarea readOnly value={codeSnippet} rows={14} className='w-full rounded border border-white/20 bg-black/30 p-2 font-mono text-xs' />
        </div>
      </div>
    </div>
  )
}
