// 캔버스에 지금 그려져 있는 프레임을 썸네일 이미지로 캡처한다.
// videoEncoder.ts가 모든 사진이 다 쌓인 마지막 장면에서 호출한다.
export function captureThumbnail(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}
