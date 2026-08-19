export interface GenerateVideoOptions {
  photos: string[]
  /** 세로형(9:16) 고정 — 인스타 스토리 / 아이폰 사진 비율 */
  aspectRatio?: '9:16'
}

/**
 * STUB — 아직 실제 인코딩 로직이 없다.
 * TODO(user): Canvas로 photos를 순차 렌더링하며 캡처한 뒤
 * MediaRecorder로 부드러운 프레임레이트의 9:16 영상을 인코딩해서 Blob으로 반환.
 * 지금은 구조 확인용 스텁이라 항상 null을 반환한다.
 */
export async function generateVideoFromFrames(_options: GenerateVideoOptions): Promise<Blob | null> {
  return null
}
