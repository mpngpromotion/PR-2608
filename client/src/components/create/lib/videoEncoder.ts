import { captureThumbnail } from './thumbnail'
import { VIDEO_FORMAT } from './videoFormat'

export interface GenerateVideoOptions {
  photos: string[]
  /** 세로형(3:4) 고정 */
  aspectRatio?: '3:4'
  /** 사진 한 장당 배정 시간(ms) — 모이는 애니메이션 + 정지 유지 시간 합 */
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

// 사진 한 장의 "흩어진 시작 위치"와 "다 모였을 때 위치"를 미리 정해둔다.
interface CardData {
  img: HTMLImageElement
  scatter: Transform
  rest: Transform
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
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

// 매 프레임 장면 전체를 다시 그린다(캔버스엔 레이어 개념이 없어서). settledCount장까지는 이미
// 다 모인 카드(rest 위치), 그 뒤는 아직 안 모인 카드(scatter 위치) — animating으로 지정한
// 카드 하나만 예외로 그 transform을 쓴다(모이는 중간 위치).
// 그리는 순서 = 쌓이는 순서(나중에 그릴수록 위로 덮는다). 배열 순서 그대로 그리면 아직
// 안 모인(인덱스가 큰) 카드가 나중에 그려져서 이미 쌓인 카드를 가려버리므로, 안 모인 카드 →
// 이미 쌓인 카드 → 지금 모이는 카드 순으로 그려서 방금 도착한 카드가 항상 맨 위로 오게 한다.
function drawScene(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  cards: CardData[],
  cardSize: number,
  settledCount: number,
  animating?: { index: number; transform: Transform },
) {
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, frameWidth, frameHeight)

  cards.forEach((card, index) => {
    if (index >= settledCount && !(animating && index === animating.index)) {
      drawCard(ctx, card.img, card.scatter, cardSize) // 아직 안 모인 카드 (맨 아래)
    }
  })
  cards.forEach((card, index) => {
    if (index < settledCount && !(animating && index === animating.index)) {
      drawCard(ctx, card.img, card.rest, cardSize) // 이미 쌓인 카드
    }
  })
  if (animating) {
    drawCard(ctx, cards[animating.index].img, animating.transform, cardSize) // 지금 모이는 카드 (맨 위)
  }
}

// -1~1 값을 반환하되, 0(중앙) 근처보다 ±1(가장자리) 근처에 훨씬 많이 몰리게 한다.
// (균등분포를 제곱근으로 누르면 큰 값 쪽 밀도가 높아진다 — Y=sqrt(X)면 f_Y(y)=2y라 y=1 근처가 조밀함.)
function edgeBiasedOffset() {
  const magnitude = Math.sqrt(Math.random())
  const sign = Math.random() < 0.5 ? -1 : 1
  return sign * magnitude
}

// 격자가 아니라 진짜 랜덤 위치로 흩어놓되, 가운데(나중에 사진이 쌓일 자리)는 되도록 비우고
// 가장자리 쪽에 몰리게 한다.
function randomScatterTransform(frameWidth: number, frameHeight: number): Transform {
  const halfW = frameWidth / 2
  const halfH = frameHeight / 2
  return {
    x: halfW + edgeBiasedOffset() * halfW * 0.9,
    y: halfH + edgeBiasedOffset() * halfH * 0.9,
    rotation: (Math.random() * 2 - 1) * VIDEO_FORMAT.scatterRotationRange,
  }
}

// 가운데 근처지만, 살짝 랜덤하게 밀린 "자유자재로 쌓인" 느낌의 도착 위치.
function randomRestTransform(centerX: number, centerY: number, cardSize: number, index: number): Transform {
  const jitter = cardSize * VIDEO_FORMAT.restJitterRatio
  return {
    x: centerX + (Math.random() * 2 - 1) * jitter + index * 2,
    y: centerY + (Math.random() * 2 - 1) * jitter + index * 2,
    rotation: (Math.random() * 2 - 1) * VIDEO_FORMAT.restRotationRange,
  }
}

// 사진 한 장을 scatter 위치에서 rest 위치까지 모이게 하면서, 프레임마다 전체 장면을 다시 그린다.
function animateCardIn(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  cards: CardData[],
  cardSize: number,
  index: number,
  duration: number,
): Promise<void> {
  return new Promise((resolve) => {
    const card = cards[index]
    const start = performance.now()

    const frame = (now: number) => {
      // 이징 없이 리니어(일정한 속도)로 모은다.
      const t = Math.min(1, (now - start) / duration)
      const current: Transform = {
        x: lerp(card.scatter.x, card.rest.x, t),
        y: lerp(card.scatter.y, card.rest.y, t),
        rotation: lerp(card.scatter.rotation, card.rest.rotation, t),
      }
      drawScene(ctx, frameWidth, frameHeight, cards, cardSize, index, { index, transform: current })

      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

function pickMimeType() {
  return VIDEO_FORMAT.mimeTypeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 사진 전부가 화면 곳곳에 흩어져있는 채로 시작해서, 한 장씩 가운데로 모이는 모션(인트로와 같은
// 느낌)을 캔버스에 그리면서 MediaRecorder로 캡처해 영상 Blob을 만든다.
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
  const flyDuration = Math.min(VIDEO_FORMAT.flyDurationMs, msPerPhoto)
  const holdDuration = Math.max(0, msPerPhoto - flyDuration)

  const cards: CardData[] = images.map((img, index) => ({
    img,
    scatter: randomScatterTransform(VIDEO_FORMAT.width, VIDEO_FORMAT.height),
    rest: randomRestTransform(centerX, centerY, cardSize, index),
  }))

  // 첫 프레임: 사진 전부가 흩어진 모습으로 시작한다.
  drawScene(ctx, VIDEO_FORMAT.width, VIDEO_FORMAT.height, cards, cardSize, 0)
  recorder.start()
  await wait(VIDEO_FORMAT.initialHoldMs)

  let thumbnailBlob: Blob | null = null
  for (const [index] of cards.entries()) {
    await animateCardIn(ctx, VIDEO_FORMAT.width, VIDEO_FORMAT.height, cards, cardSize, index, flyDuration)

    const settledCount = index + 1
    drawScene(ctx, VIDEO_FORMAT.width, VIDEO_FORMAT.height, cards, cardSize, settledCount)

    const isLast = settledCount === cards.length
    // 다 쌓인 마지막 그림을 썸네일로 쓴다.
    if (isLast) thumbnailBlob = await captureThumbnail(canvas)

    onProgress?.(settledCount / cards.length)
    await wait(isLast ? VIDEO_FORMAT.finalHoldMs : holdDuration)
  }
  recorder.stop()

  const blob = await recorded
  return { blob, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm', thumbnailBlob }
}
