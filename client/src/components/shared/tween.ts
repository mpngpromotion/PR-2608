/** 0→1을 duration(ms)에 걸쳐 매 프레임 onUpdate로 흘려주는 간단한 tween. 취소용 cancel 함수를 반환. */
export function tweenProgress(duration: number, onUpdate: (t: number) => void, onComplete?: () => void) {
  let frame: number
  const start = performance.now()

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    onUpdate(t)
    if (t < 1) {
      frame = requestAnimationFrame(tick)
    } else {
      onComplete?.()
    }
  }
  frame = requestAnimationFrame(tick)

  return () => cancelAnimationFrame(frame)
}
