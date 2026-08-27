import { captureThumbnail } from './thumbnail'
import { VIDEO_FORMAT } from './videoFormat'

export interface GenerateVideoOptions {
  photos: string[]
  /** 세로형(3:4) 고정 */
  aspectRatio?: '3:4'
  /** 사진 한 장당 정지해있는 시간(ms) */
  msPerPhoto?: number
  /** 0~1 진행률 콜백 (로딩바 표시용) */
  onProgress?: (progress: number) => void
}

export interface GeneratedVideo {
  blob: Blob
  extension: 'mp4' | 'webm'
  thumbnailBlob: Blob | null
}

interface Transform {
  /** 카드 중심의 x, y (px) */
  x: number
  y: number
  /** degree */
  rotation: number
}

// 사진 한 장과, 가운데에 나타날 때의 위치(살짝 랜덤하게 밀리고 회전된 자리).
interface CardData {
  img: HTMLImageElement
  transform: Transform
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// 회전된 클립 경계와 이미지 가장자리가 픽셀 단위로 딱 안 맞으면 안티앨리어싱 때문에 그
// 밑에 깔린(그림자용) 사각형이 아주 얇게 비쳐서 카드마다 테두리 선처럼 보인다. 그래서 클립
// 영역보다 이미지를 살짝(3%) 더 크게 그려서 그 이음새를 완전히 덮는다.
const CLIP_OVERSCAN = 1.03

// 사진을 정사각형으로 크롭(cover)해서 transform 위치·각도로 그린다. 그림자는 클립(잘림) 걸기
// 전에 같은 자리의 사각형을 먼저 채워서 만든다 — 클립 상태에서 그림자를 그리면 브라우저에
// 따라 그림자가 클립 경계에서 잘려버려서, 클립 없는 사각형으로 그림자만 먼저 깔아둔다.
function drawCard(ctx: CanvasRenderingContext2D, img: HTMLImageElement, transform: Transform, size: number) {
  const overscanSize = size * CLIP_OVERSCAN
  const scale = Math.max(overscanSize / img.width, overscanSize / img.height)
  const drawWidth = img.width * scale
  const drawHeight = img.height * scale

  ctx.save()
  ctx.translate(transform.x, transform.y)
  ctx.rotate((transform.rotation * Math.PI) / 180)

  // 사진이 많이 겹칠 때(사진 개수가 많을 때) 그림자끼리 겹쳐서 진해지므로, 살짝 약하게 잡는다.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 5
  ctx.fillStyle = 'white'
  ctx.fillRect(-size / 2, -size / 2, size, size)
  ctx.shadowColor = 'transparent'

  ctx.beginPath()
  ctx.rect(-size / 2, -size / 2, size, size)
  ctx.clip()
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()
}

// 매 프레임 장면 전체를 다시 그린다(캔버스엔 레이어 개념이 없어서). visibleCount장까지만
// 그린다 — 배열 순서 그대로 그려서, 나중에 나타난(인덱스가 큰) 카드가 항상 맨 위로 덮는다.
function drawScene(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  cards: CardData[],
  cardSize: number,
  visibleCount: number,
) {
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, frameWidth, frameHeight)

  for (let i = 0; i < visibleCount; i++) {
    drawCard(ctx, cards[i].img, cards[i].transform, cardSize)
  }
}

// 가운데지만, 살짝 랜덤하게 밀리고 회전된 "여러 장 겹쳐 쌓인" 느낌의 자리.
function randomStackTransform(centerX: number, centerY: number, cardSize: number, index: number): Transform {
  const jitter = cardSize * VIDEO_FORMAT.restJitterRatio
  return {
    x: centerX + (Math.random() * 2 - 1) * jitter + index * 2,
    y: centerY + (Math.random() * 2 - 1) * jitter + index * 2,
    rotation: (Math.random() * 2 - 1) * VIDEO_FORMAT.restRotationRange,
  }
}

function pickMimeType() {
  return VIDEO_FORMAT.mimeTypeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 사진이 한 장씩 날아오지 않고 가운데에 바로 나타나면서, 여러 장 겹친 종이 더미처럼 쌓이는
// 모션을 캔버스에 그리면서 MediaRecorder로 캡처해 영상 Blob을 만든다.
export async function generateVideoFromFrames({
  photos,
  msPerPhoto = VIDEO_FORMAT.msPerPhoto,
  onProgress,
}: GenerateVideoOptions): Promise<GeneratedVideo | null> {
  if (photos.length === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_FORMAT.width
  canvas.height = VIDEO_FORMAT.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const images = await Promise.all(photos.map(loadImage))

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(canvas.captureStream(VIDEO_FORMAT.fps), { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const recorded = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  const centerX = VIDEO_FORMAT.width / 2
  const centerY = VIDEO_FORMAT.height / 2
  const cardSize = VIDEO_FORMAT.width * VIDEO_FORMAT.cardSizeRatio

  const cards: CardData[] = images.map((img, index) => ({
    img,
    transform: randomStackTransform(centerX, centerY, cardSize, index),
  }))

  // 첫 프레임: 아직 사진이 하나도 없는 빈 화면으로 시작한다.
  drawScene(ctx, VIDEO_FORMAT.width, VIDEO_FORMAT.height, cards, cardSize, 0)
  recorder.start()
  await wait(VIDEO_FORMAT.initialHoldMs)

  let thumbnailBlob: Blob | null = null
  for (const [index] of cards.entries()) {
    const visibleCount = index + 1
    drawScene(ctx, VIDEO_FORMAT.width, VIDEO_FORMAT.height, cards, cardSize, visibleCount)

    const isLast = visibleCount === cards.length
    // 다 쌓인 마지막 그림을 썸네일로 쓴다.
    if (isLast) thumbnailBlob = await captureThumbnail(canvas)

    onProgress?.(visibleCount / cards.length)
    await wait(isLast ? VIDEO_FORMAT.finalHoldMs : msPerPhoto)
  }
  recorder.stop()

  const blob = await recorded
  return { blob, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm', thumbnailBlob }
}
