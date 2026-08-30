import { MOOD_FILM_TITLE_FONT_FAMILY, MOOD_FILM_TITLE_FONT_URLS } from '../templates/moodFilmTitleTemplate'

let fontLoadPromise: Promise<void> | null = null

// 캔버스 텍스트(fillText)는 document.fonts에 로드가 끝난 폰트만 즉시 반영하므로,
// 첫 렌더 프레임 전에 반드시 이 로딩이 끝나 있어야 한다.
export function ensureTitleFontLoaded(): Promise<void> {
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      await Promise.all(
        Object.entries(MOOD_FILM_TITLE_FONT_URLS).map(async ([weight, url]) => {
          const fontFace = new FontFace(MOOD_FILM_TITLE_FONT_FAMILY, `url(${url})`, { weight })
          const loaded = await fontFace.load()
          document.fonts.add(loaded)
        }),
      )
    })()
  }
  return fontLoadPromise
}
