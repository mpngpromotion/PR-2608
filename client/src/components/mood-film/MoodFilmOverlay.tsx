'use client'

import { MoodFilmPopup } from './MoodFilmPopup'

// TODO(user): 실제 무드필름 영상 플레이어로 교체
export function MoodFilmOverlay() {
  return (
    <div className="space-y-6">
      <div className="flex aspect-video w-full items-center justify-center bg-zinc-200">
        무드필름 영상 placeholder
      </div>
      <MoodFilmPopup />
    </div>
  )
}
