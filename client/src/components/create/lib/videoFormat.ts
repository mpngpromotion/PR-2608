// 무드필름 영상 포맷을 한 곳에서 관리한다. 화질/비율/프레임레이트/코덱을 바꾸고 싶으면 여기만 고치면 된다.
export const VIDEO_FORMAT = {
  width: 720,
  height: 960, // 3:4 세로형
  fps: 60,
  msPerPhoto: 1000, // 사진 한 장당 배정 시간(날아오는 애니메이션 + 정지 유지 시간 합)
  // mp4가 호환성이 제일 좋아서 우선 시도하고, 브라우저가 못 만들면 webm으로 폴백한다.
  mimeTypeCandidates: [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ],

  // 사진 전부가 화면 곳곳에 흩어져있는 채로 시작해서, 한 장씩 가운데로 모이는 모션
  // (인트로 모션과 같은 느낌) 설정.
  cardSizeRatio: 0.42, // 카드(정사각형) 한 변 크기 — 프레임 가로폭 기준 비율
  restJitterRatio: 0.06, // 다 모였을 때 카드 중심이 살짝 랜덤하게 밀리는 정도 — 카드 크기 기준 비율
  restRotationRange: 12, // 다 모였을 때의 랜덤 회전각 범위(도), ±
  scatterRotationRange: 50, // 흩어져있을 때의 랜덤 회전각 범위(도), ±
  flyDurationMs: 550, // 사진 한 장이 가운데로 모이는 데 걸리는 시간(ms)
  initialHoldMs: 400, // 첫 사진이 움직이기 전, 전부 흩어진 모습을 보여주는 시간(ms)
  finalHoldMs: 2000, // 마지막 사진까지 다 모인 뒤, 영상이 끝나기 전 정지해있는 시간(ms)
} as const
