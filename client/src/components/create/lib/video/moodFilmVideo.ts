import { registerAacEncoder } from '@mediabunny/aac-encoder'
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
} from 'mediabunny'

const FPS = 30
export const MOOD_FILM_FPS = FPS
export const MOOD_FILM_DURATION = 633 / FPS
const DURATION = MOOD_FILM_DURATION

// Premiere XML에서 추출한 레이어별 등장 프레임/좌표/회전. 정확히 12장 기준.
// rotation은 라디안이 아니라 실제 각도(360도 기준, degree) — drawFrame 안에서 라디안으로 변환해서 쓴다.
const layers = [
  { start: 0, rotation: -5, x: 0, y: 0 },
  { start: 42, rotation: -13, x: 0, y: -0.00897223 },
  { start: 86, rotation: 3, x: 0.00913757, y: -0.00519641 },
  { start: 168, rotation: -4, x: 0, y: 0 },
  { start: 207, rotation: 8, x: 0, y: -0.0146329 },
  { start: 251, rotation: -5, x: 0, y: -0.00972023 },
  { start: 335, rotation: 2, x: 0, y: -0.00248016 },
  { start: 372, rotation: 0, x: 0, y: -0.00322421 },
  { start: 413, rotation: -5, x: 0, y: -0.00644841 },
  { start: 498, rotation: -2, x: 0, y: -0.00297619 },
  { start: 538, rotation: 2, x: 0, y: -0.00892857 },
  { start: 583, rotation: 2, x: 0, y: -0.0226607 },
].map((layer) => ({ ...layer, startSec: layer.start / FPS }))

export type MoodFilmLayer = (typeof layers)[number]

// 레이어 좌표 수동 튜닝용 디버그 페이지(mood-film/layer-test)에서 원본 값을 읽어가는 용도.
export const MOOD_FILM_LAYERS: MoodFilmLayer[] = layers

// 사진이 새로 나타나는 시점들(디자인 미리보기 페이지에서 "N장 등장" 버튼으로 바로 점프할 때 씀).
// 예전엔 이 시점 기준으로 인코딩 호출 자체를 줄이는 최적화도 했었는데, 프레임 하나가 몇 초씩
// 지속되는 "비정상"적인 구조가 되면서 카카오톡 공유 시 파일이 거부돼서 되돌렸다 — 지금은
// exportMoodFilmVideo가 다시 매 프레임(1/30초 균일 duration)을 전부 인코딩한다.
export const MOOD_FILM_LAYER_START_TIMES = [...new Set(layers.map((layer) => layer.startSec))].sort((a, b) => a - b)

const TYPOGRAPHY_FONT_FAMILY = 'Sofia Sans Condensed'
const TYPOGRAPHY_FONT_URL = '/fonts/SofiaSans-Variable.ttf'

let typographyFontLoadPromise: Promise<void> | null = null

// FontFace는 브라우저 전용 API라 모듈 최상단에서 바로 실행하면 Next.js의 서버 렌더링
// 단계에서도 이 파일이 평가되면서 "FontFace is not defined" 에러가 난다. 그래서 함수로
// 감싸서 실제로 그릴 때(브라우저에서)만, 그것도 한 번만 로드하도록 한다.
export function ensureTypographyFontLoaded(): Promise<void> {
  if (!typographyFontLoadPromise) {
    typographyFontLoadPromise = (async () => {
      const fontFace = new FontFace(TYPOGRAPHY_FONT_FAMILY, `url(${TYPOGRAPHY_FONT_URL})`, {
        weight: '1 1000', // 이 폰트가 지원하는 실제 범위(베리어블 폰트)
      })
      const loaded = await fontFace.load()
      document.fonts.add(loaded)
    })()
  }
  return typographyFontLoadPromise
}

type TypographyLine = {
  text: string
  x: number
  y: number
  fontFamily: string
  fontWeight: number
  fontSize: number
  tracking: number
  align: CanvasTextAlign
  scaleX: number
  scaleY: number
}

// Premiere Essential Graphics에서 읽은 실제 좌표/폰트 크기/자간 값 (1080×1440 기준).
const typography: TypographyLine[] = [
  {
    text: 'Life',
    x: 0,
    y: 793,
    fontFamily: `"${TYPOGRAPHY_FONT_FAMILY}", sans-serif`,
    fontWeight: 500,
    fontSize: 300,
    tracking: -50,
    align: 'left',
    scaleX: 0.75,
    scaleY: 0.75,
  },
  {
    text: 'is',
    x: 480,
    y: 793,
    fontFamily: `"${TYPOGRAPHY_FONT_FAMILY}", sans-serif`,
    fontWeight: 500,
    fontSize: 300,
    tracking: -50,
    align: 'left',
    scaleX: 0.75,
    scaleY: 0.75,
  },
  {
    text: 'Layer',
    x: 698.5,
    y: 793,
    fontFamily: `"${TYPOGRAPHY_FONT_FAMILY}", sans-serif`,
    fontWeight: 500,
    fontSize: 300,
    tracking: -50,
    align: 'left',
    scaleX: 0.75,
    scaleY: 0.75,
  },
  {
    text: 'SORAN EP [LAYER]',
    x: 540.7,
    y: 1410,
    fontFamily: `"${TYPOGRAPHY_FONT_FAMILY}", sans-serif`,
    fontWeight: 600,
    fontSize: 34,
    tracking: 301,
    align: 'center',
    scaleX: 0.75,
    scaleY: 0.76,
  },
]

// object-fit: cover와 동일하게, 이미지를 잘라서 목표 박스를 꽉 채운다.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageWidth = img.naturalWidth || img.width
  const imageHeight = img.naturalHeight || img.height

  const scale = Math.max(width / imageWidth, height / imageHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (imageWidth - sourceWidth) / 2
  const sourceY = (imageHeight - sourceHeight) / 2

  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

// 글자 사이 간격(자간, tracking)을 적용해서 한 글자씩 그린다. ctx.font/fillStyle은 호출 전에 맞춰둬야 한다.
function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: CanvasTextAlign,
  fontSize: number,
) {
  const spacing = (fontSize * tracking) / 1000
  const chars = [...text]
  const widths = chars.map((char) => ctx.measureText(char).width)
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, chars.length - 1)

  let cursor = x
  if (align === 'center') cursor -= totalWidth / 2
  else if (align === 'right') cursor -= totalWidth

  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y)
    cursor += widths[index] + spacing
  })
}

function drawTypography(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
  // Premiere 시퀀스(1080×1440) 기준 좌표를 실제 출력 해상도에 맞게 비례 축소한다.
  const sx = width / 1080
  const sy = height / 1440

  for (const line of typography) {
    ctx.save()
    ctx.translate(line.x * sx, line.y * sy)
    ctx.scale(line.scaleX * sx, line.scaleY * sy)

    ctx.fillStyle = color
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.font = `${line.fontWeight} ${line.fontSize}px ${line.fontFamily}`

    drawTrackedText(ctx, line.text, 0, 0, line.tracking, line.align, line.fontSize)

    ctx.restore()
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  time: number,
  width: number,
  height: number,
  color: string,
  customLayers: MoodFilmLayer[] = layers,
) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Premiere에서 쓴 사진 카드 크기 — 프레임 가로폭의 약 64.4%, 3:4 카드 모양.
  const photoWidth = width * 0.644
  const photoHeight = (photoWidth * 4) / 3

  customLayers.forEach((layer, index) => {
    if (time < layer.startSec) return

    const image = images[index]
    if (!image) return

    const centerX = width / 2 + layer.x * width
    const centerY = height / 2 + layer.y * height

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate((layer.rotation * Math.PI) / 180)

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Premiere Lumetri Contrast +25 근사치. 정확한 .cube LUT 재현은 포함하지 않는다.
    ctx.filter = 'contrast(1.25) saturate(1)'
    drawCover(ctx, image, -photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight)
    ctx.filter = 'none'

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(-photoWidth / 2 + 0.5, -photoHeight / 2 + 0.5, photoWidth - 1, photoHeight - 1)

    ctx.restore()
  })

  drawTypography(ctx, width, height, color)
}

// BGM이 영상 길이보다 길면 duration만큼만 잘라서 쓴다 (짧으면 그대로 두고, 남는 구간은 무음).
function trimAudioBuffer(audioContext: AudioContext, input: AudioBuffer, duration: number): AudioBuffer {
  const frameCount = Math.min(input.length, Math.ceil(duration * input.sampleRate))
  const output = audioContext.createBuffer(input.numberOfChannels, frameCount, input.sampleRate)

  for (let channel = 0; channel < input.numberOfChannels; channel++) {
    output.copyToChannel(input.getChannelData(channel).subarray(0, frameCount), channel)
  }

  return output
}

// deviceMemory(Device Memory API)는 표준 DOM 타입에 없는 비표준(Chromium 계열 전용) 필드다.
type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number }

// 모바일/저사양 기기(메모리 4GB 이하 또는 코어 4개 이하)에서는 해상도/비트레이트를 낮춘다.
function getExportSettings() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer:coarse)').matches
  const deviceMemory = (navigator as NavigatorWithDeviceMemory).deviceMemory
  const lowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4
  const constrained = isMobile || lowMemory || lowCpu

  // 사진이 대부분 정지해있는 콘텐츠라 비트레이트를 살짝만 낮춰도 화질 체감 차이는 거의 없다.
  if (constrained) return { width: 810, height: 1080, bitrate: 5_000_000 }
  return { width: 1080, height: 1440, bitrate: 9_000_000 }
}

let aacEncoderRegistered = false

export type ExportMoodFilmVideoOptions = {
  images: HTMLImageElement[]
  bgmFile: Blob
  /** 사진 테두리 + 타이틀 텍스트에 같이 쓰는 색상 */
  color: string
  /** 취소되면 인코딩을 즉시 중단한다 (React StrictMode의 두 번째 마운트 대비용) */
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

export type ExportMoodFilmVideoResult = {
  blob: Blob
  thumbnailBlob: Blob | null
}

export async function exportMoodFilmVideo({
  images,
  bgmFile,
  color,
  signal,
  onProgress,
}: ExportMoodFilmVideoOptions): Promise<ExportMoodFilmVideoResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs를 지원하는 브라우저가 필요합니다.')
  }

  signal?.throwIfAborted()

  await ensureTypographyFontLoaded()

  // H.264 비디오는 폴리필이 없어서 네이티브 VideoEncoder가 필수지만, AAC는 브라우저마다 네이티브
  // 지원이 들쭉날쭉해서 없으면 WASM 폴리필을 등록해 계속 WebCodecs 경로를 쓴다.
  if (!aacEncoderRegistered && !(await canEncodeAudio('aac'))) {
    registerAacEncoder()
    aacEncoderRegistered = true
  }

  const audioContext = new AudioContext()
  const audioArrayBuffer = await bgmFile.arrayBuffer()
  const decodedAudioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)
  const audioBuffer = trimAudioBuffer(audioContext, decodedAudioBuffer, DURATION)

  const { width, height, bitrate } = getExportSettings()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
  if (!ctx) throw new Error('2D canvas context is unavailable.')

  try {
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    })

    const videoSource = new CanvasSource(canvas, {
      codec: 'avc',
      quality: new Quality({ bitrate }),
      // 화질보다 인코딩 속도를 우선한다 — 프레임 타이밍/개수는 안 바뀌니 카카오톡 공유
      // 호환성엔 영향 없다.
      latencyMode: 'realtime',
    })
    output.addVideoTrack(videoSource, { frameRate: FPS })

    const audioSource = new AudioBufferSource({
      codec: 'aac',
      quality: new Quality({ bitrate: 192_000 }),
    })
    output.addAudioTrack(audioSource)

    await output.start()

    const totalFrames = Math.ceil(DURATION * FPS)

    const videoJob = (async () => {
      for (let frame = 0; frame < totalFrames; frame++) {
        if (signal?.aborted) return
        const time = frame / FPS
        drawFrame(ctx, images, time, width, height, color)
        // 키프레임 시점은 강제로 정하지 않고 인코더 기본 간격(2초)에 맡긴다 — 1초마다
        // 강제하던 것보다 I-frame이 덜 나와서 더 빠르다.
        await videoSource.add(time, 1 / FPS)
        onProgress?.((frame + 1) / totalFrames)
      }
      videoSource.close()
    })()

    const audioJob = (async () => {
      if (signal?.aborted) return
      await audioSource.add(audioBuffer)
      audioSource.close()
    })()

    await Promise.all([videoJob, audioJob])

    if (signal?.aborted) {
      await output.cancel()
      signal.throwIfAborted()
    }

    // 마지막으로 그려진 프레임(사진 12장 + 타이틀 다 나온 장면)을 그대로 썸네일로 캡처한다 —
    // 캔버스를 또 만들어서 다시 그릴 필요가 없다.
    const thumbnailBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))

    await output.finalize()

    const buffer = output.target.buffer
    if (!buffer) throw new Error('mediabunny가 출력 버퍼를 만들지 못했습니다.')

    return { blob: new Blob([buffer], { type: 'video/mp4' }), thumbnailBlob }
  } finally {
    await audioContext.close()
  }
}
