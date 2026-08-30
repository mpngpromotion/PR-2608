export type MoodFilmLayerTemplate = {
  start: number
  end: number
  rotation: number
  x: number
  y: number
}

export const MOOD_FILM_DURATION = 21.1
export const MOOD_FILM_FPS = 30

// Premiere 프로젝트 XML에서 추출한 레이어별 등장 타이밍/좌표. 정확히 12장 기준으로 짜여 있다.
export const moodFilmTemplate: MoodFilmLayerTemplate[] = [
  { start: 0, end: 21.1, rotation: -5, x: 0, y: 0 },
  { start: 1.333, end: 21.1, rotation: -13, x: 0, y: -0.003472 },
  { start: 2.767, end: 21.1, rotation: 3, x: 0.003638, y: -0.006696 },
  { start: 5.533, end: 21.1, rotation: -4, x: 0, y: 0 },
  { start: 6.833, end: 21.1, rotation: 8, x: 0, y: -0.014633 },
  { start: 8.267, end: 21.1, rotation: -5, x: 0, y: -0.00372 },
  { start: 11.1, end: 21.1, rotation: 2, x: 0, y: -0.00248 },
  { start: 12.333, end: 21.1, rotation: 0, x: 0, y: -0.003224 },
  { start: 13.7, end: 21.1, rotation: -5, x: 0, y: -0.006448 },
  { start: 16.533, end: 21.1, rotation: -2, x: 0, y: -0.002976 },
  { start: 17.833, end: 21.1, rotation: 2, x: 0, y: -0.008929 },
  { start: 19.333, end: 21.1, rotation: 2, x: 0, y: -0.011161 },
]
