import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeAudio, canEncodeVideo } from 'mediabunny'

import { ensureTitleFontLoaded } from './loadFont'
import { exportWithMediaRecorder } from './mediaRecorderExport'
import { renderFrame, type Layer } from './renderFrame'

export type ExportVideoOptions = {
  layers: Layer[]
  bgmFile: File | Blob
  duration: number
  /** 타이틀 텍스트 색상(사진 테두리 색과 같은 값을 쓴다) */
  titleColor: string
  fps?: number
  isMobile?: boolean
  onProgress?: (progress: number) => void
}

/**
 * 캔버스에 렌더링한 프레임을 WebCodecs(H.264 + AAC)로 인코딩해 MP4 Blob으로 만든다.
 * WebCodecs/MP4 muxing을 지원하지 않는 브라우저에서는 MediaRecorder 실시간 캡처로 자동
 * 폴백한다 — 화면에 보이는 결과는 두 경로 모두 renderFrame()을 공유하므로 동일하다.
 */
export async function exportVideo({ layers, bgmFile, duration, titleColor, fps = 30, isMobile = false, onProgress }: ExportVideoOptions): Promise<Blob> {
  const width = isMobile ? 810 : 1080
  const height = isMobile ? 1080 : 1440
  const videoBitrate = isMobile ? 6_000_000 : 12_000_000

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
  if (!ctx) throw new Error('2D canvas context is unavailable.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  await ensureTitleFontLoaded()

  const audioContext = new AudioContext()

  try {
    const audioArrayBuffer = await bgmFile.arrayBuffer()
    const decodedAudioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)
    const audioBuffer = trimAudioBuffer(audioContext, decodedAudioBuffer, duration)

    const useWebCodecs = await supportsWebCodecsExport({ width, height, audioBuffer })

    if (!useWebCodecs) {
      return await exportWithMediaRecorder({ canvas, ctx, width, height, layers, duration, fps, titleColor, audioContext, audioBuffer, onProgress })
    }

    return await exportWithMediabunny({ canvas, ctx, width, height, layers, duration, fps, titleColor, videoBitrate, audioBuffer, onProgress })
  } finally {
    await audioContext.close()
  }
}

async function supportsWebCodecsExport({ width, height, audioBuffer }: { width: number; height: number; audioBuffer: AudioBuffer }): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return false

  try {
    const [videoOk, audioOk] = await Promise.all([
      canEncodeVideo('avc', { width, height }),
      canEncodeAudio('aac', {
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
      }),
    ])
    return videoOk && audioOk
  } catch {
    return false
  }
}

// BGM이 영상 길이보다 길면 duration만큼만 잘라서 쓴다 (짧으면 그대로 두고, 남는 구간은 무음).
function trimAudioBuffer(audioContext: AudioContext, buffer: AudioBuffer, maxDurationSec: number): AudioBuffer {
  if (buffer.duration <= maxDurationSec) return buffer

  const frameCount = Math.floor(maxDurationSec * buffer.sampleRate)
  const trimmed = audioContext.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.copyToChannel(buffer.getChannelData(channel).subarray(0, frameCount), channel)
  }
  return trimmed
}

async function exportWithMediabunny({
  canvas,
  ctx,
  width,
  height,
  layers,
  duration,
  fps,
  titleColor,
  videoBitrate,
  audioBuffer,
  onProgress,
}: {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  layers: Layer[]
  duration: number
  fps: number
  titleColor: string
  videoBitrate: number
  audioBuffer: AudioBuffer
  onProgress?: (progress: number) => void
}): Promise<Blob> {
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  })

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate: videoBitrate }),
    latencyMode: 'realtime',
  })
  output.addVideoTrack(videoSource, { frameRate: fps })

  const audioSource = new AudioBufferSource({
    codec: 'aac',
    quality: new Quality('high'),
  })
  output.addAudioTrack(audioSource)

  await output.start()

  const totalFrames = Math.ceil(duration * fps)
  const frameDuration = 1 / fps

  // 오디오 인코딩은 캔버스와 무관하니 비디오 프레임 루프와 동시에 진행한다.
  const videoJob = (async () => {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const time = frameIndex / fps
      renderFrame({ ctx, width, height, layers, time, titleColor })
      await videoSource.add(time, frameDuration)
      onProgress?.((frameIndex + 1) / totalFrames)
    }
  })()
  const audioJob = audioSource.add(audioBuffer)

  await Promise.all([videoJob, audioJob])
  await output.finalize()

  const buffer = output.target.buffer
  if (!buffer) throw new Error('mediabunny가 출력 버퍼를 만들지 못했습니다.')

  return new Blob([buffer], { type: 'video/mp4' })
}
