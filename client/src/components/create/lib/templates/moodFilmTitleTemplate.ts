// Premiere XML의 4개 그래픽 트랙("Life"/"is"/"Layer"/"SORAN EP [Layer]")을 근사 복원한 값.
// 실제 텍스트 애니메이션/자간은 Premiere 내부 전용 바이너리(소스 텍스트)에 있어 XML만으로는
// 픽셀 단위 복원이 불가능해서, 위치·크기·글꼴 정도만 맞춘 근사치다.
// 원본은 SF Pro Compressed였지만 Apple 플랫폼 앱 전용 라이선스라 웹에 배포할 수 없어,
// 비슷한 느낌의 무료 폰트(Inter Tight)로 대체했다.
export type MoodFilmTitleLine = {
  text: string
  /** 프레임 가로 기준 정규화된 x (0~1). align='center'면 중심, 'left'면 왼쪽 시작점. */
  x: number
  /** 프레임 세로 기준 정규화된 y (0~1). textBaseline='top' 기준. */
  y: number
  /** 프레임 세로 기준 정규화된 폰트 크기 */
  fontSizeRatio: number
  align: 'left' | 'center'
  fontWeight: 400 | 700
}

export const MOOD_FILM_TITLE_FONT_FAMILY = 'Inter Tight'
export const MOOD_FILM_TITLE_FONT_URLS = {
  400: '/fonts/InterTight-Regular.ttf',
  700: '/fonts/InterTight-Bold.ttf',
} as const

export const moodFilmTitleLines: MoodFilmTitleLine[] = [
  { text: 'LIFE', x: 0.055, y: 0.05, fontSizeRatio: 44 / 1440, align: 'left', fontWeight: 700 },
  { text: 'LAYER', x: 0.055, y: 0.078, fontSizeRatio: 44 / 1440, align: 'left', fontWeight: 700 },
  { text: 'IS', x: 0.055, y: 0.106, fontSizeRatio: 44 / 1440, align: 'left', fontWeight: 700 },
  { text: 'SORAN EP · LAYER', x: 0.5, y: 1 - 76 / 1440, fontSizeRatio: 18 / 1440, align: 'center', fontWeight: 400 },
]
