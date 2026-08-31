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

// 타이포그래피는 직접 만든 SVG(글자 하나하나가 벡터 패스, 전부 같은 색)를 사용자가 고른
// 색으로 물들여서 쓴다. 1080×1440 기준으로 그려져 있어서, 실제 출력 해상도에 맞게
// drawImage로 늘려 그리면 된다.
const TYPOGRAPHY_SVG_URL = '/video/template.svg'
// SVG 안에서 실제로 쓰이는 채우기 색 — 이 값을 사용자가 고른 색으로 치환한다.
const TYPOGRAPHY_SVG_SOURCE_COLOR = '#131313'

let typographySvgTextPromise: Promise<string> | null = null

function loadTypographySvgText(): Promise<string> {
  if (!typographySvgTextPromise) {
    typographySvgTextPromise = fetch(TYPOGRAPHY_SVG_URL).then((response) => response.text())
  }
  return typographySvgTextPromise
}

let cachedTypographyOverlay: { color: string; image: HTMLImageElement } | null = null

// 같은 색이면 다시 안 만들고 캐시해둔 걸 그대로 쓴다 — 색이 바뀔 때만 다시 만든다.
export async function prepareTypographyOverlay(color: string): Promise<HTMLImageElement> {
  if (cachedTypographyOverlay && cachedTypographyOverlay.color === color) {
    return cachedTypographyOverlay.image
  }

  const svgText = await loadTypographySvgText()
  const recoloredSvg = svgText.replaceAll(TYPOGRAPHY_SVG_SOURCE_COLOR, color)
  const url = URL.createObjectURL(new Blob([recoloredSvg], { type: 'image/svg+xml' }))

  try {
    const image = new Image()
    image.src = url
    await image.decode()
    cachedTypographyOverlay = { color, image }
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Premiere에서 쓴 사진 카드 크기 — 프레임 가로폭의 약 64.4%, 3:4 카드 모양.
const PHOTO_WIDTH_RATIO = 0.644
const PHOTO_ASPECT = 4 / 3

// object-fit: cover와 동일하게, 이미지를 잘라서 목표 박스를 꽉 채운다.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const imageWidth = img.naturalWidth || img.width
  const imageHeight = img.naturalHeight || img.height

  const scale = Math.max(width / imageWidth, height / imageHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (imageWidth - sourceWidth) / 2
  const sourceY = (imageHeight - sourceHeight) / 2

  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  time: number,
  width: number,
  height: number,
  color: string,
  typographyOverlay: HTMLImageElement,
  customLayers: MoodFilmLayer[] = layers,
) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const photoWidth = width * PHOTO_WIDTH_RATIO
  const photoHeight = photoWidth * PHOTO_ASPECT

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

  // 타이포그래피 SVG는 1080×1440 기준으로 그려져 있어서, 출력 해상도에 맞게 늘려 그린다.
  ctx.drawImage(typographyOverlay, 0, 0, width, height)
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

  const typographyOverlay = await prepareTypographyOverlay(color)

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
        drawFrame(ctx, images, time, width, height, color, typographyOverlay)
        // 키프레임 시점은 강제로 정하지 않고 인코더 기본 간격(2초)에 맡긴다 — 1초마다
        // 강제하던 것보다 I-frame이 덜 나와서 더 빠르다.
        await videoSource.add(time, 1 / FPS)
        // add()는 "더 받을 준비 됐다"는 뜻으로 인코더가 실제로 다 처리하기 전에 먼저
        // resolve될 수 있어서, 여기서 진행률을 100%까지 다 채우면 실제로는 close()/
        // finalize()에서 밀린 작업이 끝나길 기다리는 동안 진행률만 100%에 멈춰 보인다.
        // 그래서 95%까지만 채우고, 나머지는 마무리 단계에서 채운다.
        onProgress?.(((frame + 1) / totalFrames) * 0.95)
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

    onProgress?.(0.97)

    // 마지막으로 그려진 프레임(사진 12장 + 타이틀 다 나온 장면)을 그대로 썸네일로 캡처한다 —
    // 캔버스를 또 만들어서 다시 그릴 필요가 없다.
    const thumbnailBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))

    await output.finalize()
    onProgress?.(1)

    const buffer = output.target.buffer
    if (!buffer) throw new Error('mediabunny가 출력 버퍼를 만들지 못했습니다.')

    return { blob: new Blob([buffer], { type: 'video/mp4' }), thumbnailBlob }
  } finally {
    await audioContext.close()
  }
}
