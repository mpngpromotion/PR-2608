import { MoodFilmOverlay } from "@/components/mood-film/MoodFilmOverlay";

// 직접 진입/새로고침 시 렌더되는 단독 풀페이지 (인트로 없이).
export default function MoodFilmPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-16">
      <MoodFilmOverlay />
    </div>
  );
}
