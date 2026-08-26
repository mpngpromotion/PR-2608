export interface GenerateVideoOptions {
  photos: string[]
  /** 세로형(9:16) 고정 — 인스타 스토리 / 아이폰 사진 비율 */
  aspectRatio?: '9:16'
  /** 사진 한 장당 노출 시간(ms) */
  msPerPhoto?: number
  /** 0~1 진행률 콜백 (로딩바 표시용) */
  onProgress?: (progress: number) => void
}

export interface GeneratedVideo {
  blob: Blob
  extension: 'mp4' | 'webm'
}

const FRAME_WIDTH = 720
const FRAME_HEIGHT = 1280

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// object-fit: cover 처럼 캔버스를 꽉 채우도록 그린다.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(FRAME_WIDTH / img.width, FRAME_HEIGHT / img.height)
  const width = img.width * scale
  const height = img.height * scale
  const x = (FRAME_WIDTH - width) / 2
  const y = (FRAME_HEIGHT - height) / 2

  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
  ctx.drawImage(img, x, y, width, height)
}

// mp4가 호환성이 제일 좋아서 우선 시도하고, 브라우저가 못 만들면 webm으로 폴백한다.
function pickMimeType() {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 사진들을 캔버스에 순서대로 그리면서 MediaRecorder로 캡처해 영상 Blob을 만든다.
export async function generateVideoFromFrames({
  photos,
  msPerPhoto = 1500,
  onProgress,
}: GenerateVideoOptions): Promise<GeneratedVideo | null> {
  if (photos.length === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_WIDTH
  canvas.height = FRAME_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const images = await Promise.all(photos.map(loadImage))

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const recorded = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  recorder.start()
  for (const [index, img] of images.entries()) {
    drawCover(ctx, img)
    onProgress?.((index + 1) / images.length)
    await wait(msPerPhoto)
  }
  recorder.stop()

  const blob = await recorded
  return { blob, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' }
}
