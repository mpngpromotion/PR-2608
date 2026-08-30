import { MOOD_FILM_DURATION, MOOD_FILM_FPS, moodFilmTemplate } from './templates/moodFilmTemplate'
import { captureThumbnail } from './thumbnail'
import { exportVideo } from './video/exportVideo'
import { urlToImage } from './video/loadImages'
import { renderFrame, type Layer } from './video/renderFrame'

export interface GenerateVideoOptions {
  photos: string[]
  /** 사진 테두리와 타이틀 텍스트에 같이 쓰는 색상 */
  color: string
  /** 0~1 진행률 콜백 (로딩바 표시용) */
  onProgress?: (progress: number) => void
}

export interface GeneratedVideo {
  blob: Blob
  extension: 'mp4' | 'webm'
  thumbnailBlob: Blob | null
}

// TODO: 실제 BGM 오디오 파일을 이 경로(client/public/audio/moodfilm-bgm.mp3)에 넣어주세요.
const BGM_URL = '/audio/moodfilm-bgm.mp3'

const REQUIRED_PHOTO_COUNT = moodFilmTemplate.length

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

// Premiere에서 추출한 무드필름 타임라인(moodFilmTemplate)을 그대로 재현해 영상을 만든다.
export async function generateVideoFromFrames({ photos, color, onProgress }: GenerateVideoOptions): Promise<GeneratedVideo | null> {
  if (photos.length !== REQUIRED_PHOTO_COUNT) return null

  const isMobile = isMobileDevice()
  const width = isMobile ? 810 : 1080
  const height = isMobile ? 1080 : 1440

  const images = await Promise.all(photos.map(urlToImage))
  const layers: Layer[] = moodFilmTemplate.map((template, index) => ({
    ...template,
    image: images[index],
    borderColor: color,
  }))

  const bgmResponse = await fetch(BGM_URL)
  if (!bgmResponse.ok) {
    throw new Error(`BGM 파일을 불러오지 못했습니다: ${BGM_URL}`)
  }
  const bgmFile = await bgmResponse.blob()

  const blob = await exportVideo({
    layers,
    bgmFile,
    duration: MOOD_FILM_DURATION,
    fps: MOOD_FILM_FPS,
    isMobile,
    titleColor: color,
    onProgress,
  })

  const thumbnailBlob = await captureFinalThumbnail(layers, width, height, color)

  return {
    blob,
    extension: blob.type.includes('mp4') ? 'mp4' : 'webm',
    thumbnailBlob,
  }
}

// 마지막 사진까지 다 나타난 장면을 썸네일로 쓴다. 모든 레이어의 end가 MOOD_FILM_DURATION과
// 같아서, 정확히 duration 시점에 그리면 renderFrame이 전부 걸러버리므로 한 프레임 전으로 뺀다.
async function captureFinalThumbnail(layers: Layer[], width: number, height: number, titleColor: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null

  renderFrame({ ctx, width, height, layers, time: MOOD_FILM_DURATION - 1 / MOOD_FILM_FPS, titleColor })
  return captureThumbnail(canvas)
}
