import { MOOD_FILM_TITLE_FONT_FAMILY, moodFilmTitleLines } from '../templates/moodFilmTitleTemplate'

export type Layer = {
  image: HTMLImageElement
  start: number
  end: number
  rotation: number
  x: number
  y: number
  borderColor?: string
}

export type RenderFrameOptions = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  layers: Layer[]
  time: number
  /** 타이틀 텍스트 색상(사진 테두리 색과 같은 값을 쓴다) */
  titleColor: string
}

// Premiere에서 쓴 사진 카드 크기 — 프레임 가로폭의 약 64.4%, 3:4 카드 모양으로 고정.
// 사용자가 올리는 사진마다 해상도가 달라도(원본 픽셀 기준이 아니라 프레임 기준이라) 항상
// 같은 크기로 보인다.
const PHOTO_WIDTH_RATIO = 0.644
const PHOTO_ASPECT = 4 / 3

// object-fit: cover와 동일하게, 이미지를 잘라서 목표 박스를 꽉 채운다.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const imageWidth = img.naturalWidth
  const imageHeight = img.naturalHeight

  const scale = Math.max(width / imageWidth, height / imageHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (imageWidth - sourceWidth) / 2
  const sourceY = (imageHeight - sourceHeight) / 2

  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

export function renderFrame({ ctx, width, height, layers, time, titleColor }: RenderFrameOptions) {
  ctx.clearRect(0, 0, width, height)

  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const photoWidth = width * PHOTO_WIDTH_RATIO
  const photoHeight = photoWidth * PHOTO_ASPECT

  for (const layer of layers) {
    if (time < layer.start || time >= layer.end) continue

    const centerX = width / 2 + layer.x * width
    const centerY = height / 2 + layer.y * height

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate((layer.rotation * Math.PI) / 180)

    // Premiere Lumetri Contrast +25 근사치. 정확한 .cube LUT 재현은 포함하지 않는다.
    ctx.filter = 'contrast(1.25)'

    drawCover(ctx, layer.image, -photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight)

    ctx.filter = 'none'

    if (layer.borderColor) {
      ctx.strokeStyle = layer.borderColor
      ctx.lineWidth = 1
      ctx.strokeRect(-photoWidth / 2 + 0.5, -photoHeight / 2 + 0.5, photoWidth - 1, photoHeight - 1)
    }

    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = titleColor
  ctx.textBaseline = 'top'
  for (const line of moodFilmTitleLines) {
    ctx.textAlign = line.align
    ctx.font = `${line.fontWeight} ${height * line.fontSizeRatio}px "${MOOD_FILM_TITLE_FONT_FAMILY}"`
    ctx.fillText(line.text, width * line.x, height * line.y)
  }
  ctx.restore()
}
