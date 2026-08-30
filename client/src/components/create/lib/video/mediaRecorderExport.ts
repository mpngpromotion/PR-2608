import { renderFrame, type Layer } from './renderFrame'

const MIME_TYPE_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

// 일부 브라우저의 canvas.captureStream()은 캔버스가 실제로 다시 그려질 때만 스트림에 새
// 프레임을 흘려보내는 구현이라, 오래 안 건드리면 그 구간 타임스탬프가 비거나 이상해질 수
// 있어서 주기적으로 같은 장면을 다시 그려 캔버스를 "건드려"준다.
const REDRAW_INTERVAL_MS = 150

function pickMimeType() {
  return MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type MediaRecorderExportOptions = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  layers: Layer[]
  duration: number
  fps: number
  titleColor: string
  audioContext: AudioContext
  audioBuffer: AudioBuffer
  onProgress?: (progress: number) => void
}

/**
 * WebCodecs/MP4 muxing을 지원하지 않는 브라우저를 위한 실시간 캡처 폴백.
 * renderFrame()을 그대로 재사용하므로 화면에 보이는 결과(구도/움직임/색감)는 기본 경로와
 * 동일하다 — 다만 duration만큼 실시간으로 기다려야 하고, 브라우저에 따라 mp4 대신 webm이
 * 나올 수 있다.
 */
export async function exportWithMediaRecorder({
  canvas,
  ctx,
  width,
  height,
  layers,
  duration,
  fps,
  titleColor,
  audioContext,
  audioBuffer,
  onProgress,
}: MediaRecorderExportOptions): Promise<Blob> {
  const mimeType = pickMimeType()

  const videoStream = canvas.captureStream(fps)

  const audioDestination = audioContext.createMediaStreamDestination()
  const audioSourceNode = audioContext.createBufferSource()
  audioSourceNode.buffer = audioBuffer
  audioSourceNode.connect(audioDestination)

  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ])

  const recorder = new MediaRecorder(combinedStream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const recorded = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })

  renderFrame({ ctx, width, height, layers, time: 0, titleColor })
  recorder.start()
  audioSourceNode.start()

  const startTime = performance.now()
  let elapsed = 0
  while (elapsed < duration) {
    await wait(REDRAW_INTERVAL_MS)
    elapsed = (performance.now() - startTime) / 1000
    const clampedTime = Math.min(elapsed, duration)
    renderFrame({ ctx, width, height, layers, time: clampedTime, titleColor })
    onProgress?.(clampedTime / duration)
  }

  recorder.stop()
  audioSourceNode.stop()

  return recorded
}
