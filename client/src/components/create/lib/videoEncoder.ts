import { exportMoodFilmVideo } from './video/moodFilmVideo'

export interface GenerateVideoOptions {
  photos: string[]
  /** 사진 테두리와 타이틀 텍스트에 같이 쓰는 색상 */
  color: string
  /** 취소되면 인코딩을 즉시 중단한다 (React StrictMode의 두 번째 마운트 대비용) */
  signal?: AbortSignal
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

const REQUIRED_PHOTO_COUNT = 12

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 읽지 못했습니다: ${url}`))
    img.src = url
  })
}

// Premiere에서 추출한 무드필름 타임라인을 그대로 재현해 영상을 만든다.
export async function generateVideoFromFrames({ photos, color, signal, onProgress }: GenerateVideoOptions): Promise<GeneratedVideo | null> {
  if (photos.length !== REQUIRED_PHOTO_COUNT) return null

  const images = await Promise.all(photos.map(loadImage))
  signal?.throwIfAborted()

  const bgmResponse = await fetch(BGM_URL)
  if (!bgmResponse.ok) {
    throw new Error(`BGM 파일을 불러오지 못했습니다: ${BGM_URL}`)
  }
  const bgmFile = await bgmResponse.blob()

  const { blob, thumbnailBlob } = await exportMoodFilmVideo({ images, bgmFile, color, signal, onProgress })

  return {
    blob,
    extension: 'mp4',
    thumbnailBlob,
  }
}
