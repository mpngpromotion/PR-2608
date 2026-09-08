'use client'

import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import classNames from 'classnames'
import VolumeOnIcon from '@/svg/volumeOn.svg'
import VolumeOffIcon from '@/svg/volumeOff.svg'
import ReloadIcon from '@/svg/reload.svg'
import { FiCornerDownLeft } from 'react-icons/fi'
import { commonTransition } from '@/theme/transition'

export type LyricsSegment = { id: number; text: string; start: number; end: number }

const STACK_COLORS = ['yellow', 'green', 'orange', 'purple', 'pink'] as const
type StackColor = (typeof STACK_COLORS)[number]

// Tailwind가 클래스명을 정적으로 스캔하기 때문에 `text-${color}` 같은 동적 조합은 인식하지 못한다.
const COLOR_CLASS: Record<StackColor, string> = {
  yellow: 'text-yellow',
  green: 'text-green',
  orange: 'text-orange',
  purple: 'text-purple',
  pink: 'text-pink',
}

type StackedWord = {
  key: string
  text: string
  color: StackColor
  width: number
  height: number
}

// 기존 12px 기준에서 약 120% 키운 크기. 렌더링 글자와 물리 충돌 박스의 측정값을 함께 맞춘다.
const STACK_FONT = "14.4px 'Sandoll DanpyunsunB', sans-serif"
const WORD_PADDING_X = 16.8
const WORD_HEIGHT = 28.8
// 정타 판정 → 인풋 글자에 색이 입혀진 채 아주 잠깐 보임 → 인풋에서 사라짐과 동시에 그 색을
// 가진 채로 낙하 시작, 순서를 위한 대기 시간. 색이 눈에 띄되 "기다린다"는 느낌은 없게 짧게.
const MATCH_HOLD_MS = 120
// 마지막 구간의 개별 사운드가 다 끝난 뒤, 전체 흐름 재생 전에 살짝 두는 숨 고르는 시간.
const REPLAY_BUFFER_MS = 400
// 정답을 입력하고도 제출하지 않았을 때 Enter 아이콘을 다시 흔들어 주는 간격.
const ENTER_REMINDER_MS = 1500

// 띄어쓰기 유무와 IME의 유니코드 조합 방식 차이는 정답 여부에 영향을 주지 않게 한다.
const normalizeLyrics = (text: string) => text.normalize('NFC').replace(/\s/g, '')

// 타이틀곡 원곡 하나를 통째로 디코딩해두고, 정타 시 구간(start~end)만 잘라 재생한다.
// <audio> currentTime seek 대신 Web Audio API를 쓰는 이유: 아주 짧은 구간을 촘촘히 이어
// 재생해야 하는데, seek 기반 재생은 특히 iOS Safari에서 탐색 지연으로 구간이 밀리거나 끊긴다.
export const LayeringGame = ({
  segments,
  audioSrc,
  replayAudioSrc,
}: {
  segments: LyricsSegment[]
  audioSrc: string
  replayAudioSrc?: string
}) => {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing' | 'done'>('idle')
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [stacked, setStacked] = useState<StackedWord[]>([])
  const [muted, setMuted] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  // 정타 판정 직후 ~ 실제로 인풋을 비우고 낙하시키기 전까지, 인풋 글자에 입혀둘 색.
  const [matchedColor, setMatchedColor] = useState<StackColor | null>(null)
  // 입력값이 정답과 일치한 순간부터 Enter를 누르기 전까지 보여주고, 낙하 가사에도 이어지는 색.
  const [readyColor, setReadyColor] = useState<StackColor | null>(null)
  // 마지막 구간 완료 후 전체 흐름 재생까지 몇 초 남았는지(초 단위, 카운트다운 표시용).
  const [replayCountdown, setReplayCountdown] = useState<number | null>(null)
  // 전체 흐름 재생 중, 지금 재생되고 있는 지점이 어느 구간인지(그 구간의 가사 텍스트). null이면
  // 전체 재생 중이 아니라는 뜻도 겸한다.
  const [replayCurrentText, setReplayCurrentText] = useState<string | null>(null)
  const [wrongInputShaking, setWrongInputShaking] = useState(false)
  const [enterIconShaking, setEnterIconShaking] = useState(false)
  // 키보드가 레이아웃을 줄이지 않고 화면 위를 덮는 모바일 브라우저에서, 물리 바닥을 키보드
  // 위로 올리기 위한 높이. 레이아웃 자체가 줄어드는 브라우저에서는 0으로 유지된다.
  const [keyboardInset, setKeyboardInset] = useState(0)
  // 정타마다 값이 바뀐다 — <input>의 key로 써서 구간이 넘어갈 때마다 인풋 DOM 노드를 통째로
  // 새로 만든다. 이전 노드에 남아있을 수 있는 IME 조합 버퍼나, 그 노드를 향해 아직 날아오고
  // 있는 트레일링 이벤트를 텍스트 비교 같은 걸로 하나하나 걸러내지 않고 통째로 무효화한다.
  const [inputGen, setInputGen] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  // 16일 공개 버전의 완료 재생에만 사용하는 별도 하이라이트 음원.
  const replayBufferRef = useRef<AudioBuffer | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 지금 맞춰야 할 구간을 React state(index)가 아니라 ref로도 따로 들고 있는다. 한글 IME는
  // compositionend 직후 브라우저가 트레일링 input 이벤트를 한 번 더 보낼 때가 있는데, 이게
  // React가 리렌더로 handleChange를 최신 index로 교체하기 *전에* 오는 경우 이전 index를 보던
  // 낡은 클로저가 다시 실행돼서 방금 넘긴 구간을 한 번 더 정타 처리해버린다(= 다음 구간이
  // 건너뛰어지고 인풋엔 방금 지운 텍스트가 되돌아와 남아있는 것처럼 보임). ref는 리렌더를
  // 기다리지 않고 commitSegment 안에서 그 자리에서 바로 갱신되니 이 경쟁 상태를 원천적으로 막는다.
  const activeSegmentRef = useRef<LyricsSegment | null>(segments[0] ?? null)
  // 정타 판정 ~ 실제 낙하 시작 사이의 짧은 대기 구간 안에 있는지. state(matchedColor)는 비동기라
  // 그 틈에 트레일링 이벤트가 한 번 더 들어오면 commitSegment가 중복 실행될 수 있어서 ref로 막는다.
  const isHoldingRef = useRef(false)
  const wasCorrectRef = useRef(false)
  // AudioBufferSourceNode는 한 번 시작하면 별도로 참조하지 않는 한 중간에 멈출 수 없다. 현재
  // 재생 중인 소스를 보관해 새 구간 재생, 다시 듣기, 재시작, 페이지 이탈 때 확실히 정지한다.
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const matchHoldTimeoutRef = useRef<number | null>(null)
  const autoReplayTimeoutRef = useRef<number | null>(null)
  const replayIntervalRef = useRef<number | null>(null)
  const replayEndTimeoutRef = useRef<number | null>(null)
  const enterReminderTimeoutRef = useRef<number | null>(null)
  // 로딩 중 다시하기/페이지 이탈이 발생하면 완료된 비동기 작업이 게임을 다시 시작하지 못하게 한다.
  const loadGenerationRef = useRef(0)

  const floorRef = useRef<HTMLDivElement>(null)
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const bodiesRef = useRef<Map<string, Matter.Body>>(new Map())
  const elementsRef = useRef<Map<string, HTMLSpanElement>>(new Map())
  const rafRef = useRef<number | null>(null)
  // 바닥+양옆 벽 바디. 브라우저 너비가 바뀔 때 이 바디들을 새 크기로 다시 만들어 끼워넣는다 —
  // 안 그러면 벽이 처음 생성 시점의 너비에 고정된 채로 남아서, 창을 넓히면 오른쪽에 벽 없는
  // 빈 공간이 생기고 좁히면 쌓인 글자가 화면 밖으로 삐져나온다.
  const wallsRef = useRef<{ ground: Matter.Body; left: Matter.Body; right: Matter.Body } | null>(null)
  // 벽을 마지막으로 맞춰 놓은 바닥 크기. 리사이즈 때 이 값 대비 새 크기의 비율을 구해서, 이미
  // 쌓여있던 단어 바디들도 같은 비율로 옮겨준다 — 벽만 옮기고 기존 바디는 그대로 두면, 넓은
  // 화면에서 오른쪽 끝에 쌓인 단어가 화면을 좁혔을 때 보이는 영역 밖에 그대로 남아 잘려 보인다.
  const lastFloorSizeRef = useRef<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const ctx = audioCtxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return
    gain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime)
  }, [muted])

  useEffect(() => {
    const activeSources = activeSourcesRef.current
    return () => {
      loadGenerationRef.current += 1
      activeSources.forEach((source) => {
        try {
          source.stop()
        } catch {
          // 이미 자연 종료된 소스는 다시 정지할 필요가 없다.
        }
      })
      activeSources.clear()
      if (matchHoldTimeoutRef.current !== null) window.clearTimeout(matchHoldTimeoutRef.current)
      if (autoReplayTimeoutRef.current !== null) window.clearTimeout(autoReplayTimeoutRef.current)
      if (replayIntervalRef.current !== null) window.clearInterval(replayIntervalRef.current)
      if (replayEndTimeoutRef.current !== null) window.clearTimeout(replayEndTimeoutRef.current)
      if (enterReminderTimeoutRef.current !== null) window.clearTimeout(enterReminderTimeoutRef.current)
      audioCtxRef.current?.close()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (replayCountdown === null || replayCountdown <= 0) return
    const t = window.setTimeout(() => setReplayCountdown((c) => (c ?? 1) - 1), 1000)
    return () => window.clearTimeout(t)
  }, [replayCountdown])

  useEffect(() => {
    const viewport = window.visualViewport
    let rafId: number | null = null

    const updateKeyboardInset = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        const isInputFocused = document.activeElement === inputRef.current
        if (!isInputFocused || !viewport) {
          setKeyboardInset(0)
          return
        }

        // iOS처럼 키보드가 layout viewport를 줄이지 않고 visual viewport만 가리는 경우의
        // 실제 하단 가림 높이. Android처럼 innerHeight도 같이 줄어들면 자연스럽게 0이 된다.
        const coveredHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        setKeyboardInset(Math.round(coveredHeight))
      })
    }

    updateKeyboardInset()
    viewport?.addEventListener('resize', updateKeyboardInset)
    viewport?.addEventListener('scroll', updateKeyboardInset)
    window.addEventListener('resize', updateKeyboardInset)
    document.addEventListener('focusin', updateKeyboardInset)
    document.addEventListener('focusout', updateKeyboardInset)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      viewport?.removeEventListener('resize', updateKeyboardInset)
      viewport?.removeEventListener('scroll', updateKeyboardInset)
      window.removeEventListener('resize', updateKeyboardInset)
      document.removeEventListener('focusin', updateKeyboardInset)
      document.removeEventListener('focusout', updateKeyboardInset)
    }
  }, [])

  // 바닥 영역(floorRef)은 phase가 idle/loading일 땐 DOM에 없다가 playing/done에서만 마운트되니,
  // ResizeObserver도 그때그때 다시 붙여야 한다. 콜백은 벽 바디를 지우고 지금 크기로 새로 만들어
  // 끼워넣는다 — Matter 바디는 크기를 직접 바꾸는 API가 없어서 통째로 교체하는 게 제일 간단하다.
  useEffect(() => {
    const floor = floorRef.current
    if (!floor) return
    const groundOptions = { isStatic: true, friction: 0.4, restitution: 0 }
    // 옆 벽에 마찰이 있으면 회전이 고정된 글자가 비스듬히 닿았을 때 마찰력으로 중간에
    // 매달린 채 sleeping 상태가 될 수 있다. 옆 벽은 마찰을 없애 바닥까지 자연스럽게 미끄러뜨린다.
    const sideWallOptions = {
      isStatic: true,
      friction: 0,
      frictionStatic: 0,
      restitution: 0,
      label: 'lyrics-side-wall',
    }
    const observer = new ResizeObserver(() => {
      const engine = engineRef.current
      if (!engine) return
      const width = floor.clientWidth
      const height = floor.clientHeight
      if (width <= 0 || height <= 0) return

      // 모바일 키보드가 나타날 때는 주로 폭은 그대로이고 높이만 변한다. 이전에는 이 변화를
      // 무시했지만, 그러면 물리 바닥이 키보드 뒤에 남는다. 높이 변화도 반영해 벽과 기존 가사를
      // 새로 보이는 영역 안으로 함께 이동시킨다.
      const prevSize = lastFloorSizeRef.current

      const prevWalls = wallsRef.current
      if (prevWalls) Matter.World.remove(engine.world, [prevWalls.ground, prevWalls.left, prevWalls.right])
      const ground = Matter.Bodies.rectangle(width / 2, height + 10, width * 2, 20, groundOptions)
      const left = Matter.Bodies.rectangle(-10, height / 2, 20, height * 3, sideWallOptions)
      const right = Matter.Bodies.rectangle(width + 10, height / 2, 20, height * 3, sideWallOptions)
      Matter.World.add(engine.world, [ground, left, right])
      wallsRef.current = { ground, left, right }

      // 이미 쌓여있던 단어들을 이전 크기 대비 비율로 옮기고 재움 상태를 풀어준다 — sleeping
      // 바디는 물리 스텝에서 아예 빠지기 때문에 위치만 옮기고 깨우지 않으면 겹친 채로 굳거나
      // 바닥에서 살짝 뜬 채로 영원히 멈춰있게 된다.
      if (prevSize && prevSize.width > 0 && prevSize.height > 0) {
        const scaleX = width / prevSize.width
        const scaleY = height / prevSize.height
        bodiesRef.current.forEach((body) => {
          const halfW = (body.bounds.max.x - body.bounds.min.x) / 2
          const halfH = (body.bounds.max.y - body.bounds.min.y) / 2
          const nx = Math.min(Math.max(body.position.x * scaleX, halfW), Math.max(width - halfW, halfW))
          const ny = Math.min(body.position.y * scaleY, Math.max(height - halfH, halfH))
          Matter.Body.setPosition(body, { x: nx, y: ny })
          Matter.Sleeping.set(body, false)
        })
      }
      lastFloorSizeRef.current = { width, height }
    })
    observer.observe(floor)
    return () => observer.disconnect()
  }, [phase, keyboardInset])

  const current = segments[index]
  const inputColor = matchedColor ?? readyColor

  const stopActiveSources = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop()
      } catch {
        // 이미 종료된 소스일 수 있다.
      }
    })
    activeSourcesRef.current.clear()
  }

  const clearReplayTimers = () => {
    if (autoReplayTimeoutRef.current !== null) window.clearTimeout(autoReplayTimeoutRef.current)
    if (replayIntervalRef.current !== null) window.clearInterval(replayIntervalRef.current)
    if (replayEndTimeoutRef.current !== null) window.clearTimeout(replayEndTimeoutRef.current)
    autoReplayTimeoutRef.current = null
    replayIntervalRef.current = null
    replayEndTimeoutRef.current = null
  }

  const stopPlayback = () => {
    stopActiveSources()
    clearReplayTimers()
    setReplayCountdown(null)
    setReplayCurrentText(null)
  }

  const playBufferRange = (buffer: AudioBuffer | null, start: number, end: number) => {
    const ctx = audioCtxRef.current
    const gain = gainRef.current
    const duration = end - start
    if (!ctx || !buffer || !gain || duration <= 0) return false
    // 빠른 타이핑과 버튼 연타에서도 직전에 재생하던 소리는 항상 여기서 교체된다.
    stopActiveSources()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    activeSourcesRef.current.add(source)
    source.onended = () => activeSourcesRef.current.delete(source)
    source.start(0, start, duration)
    return true
  }

  const playRange = (start: number, end: number) => {
    playBufferRange(bufferRef.current, start, end)
  }

  // 완성된 전체 구간을 재생하면서, 지금 재생 중인 지점이 어느 구간인지 그 가사를 계속 갱신해서
  // 보여준다(카라오케처럼). AudioContext의 currentTime은 흐르는 실제 시간과 정확히 맞물려있어서
  // setTimeout 누적 오차 없이 "재생 시작 후 몇 초 지났는지"를 정확히 알 수 있다. 자동으로
  // 이어지는 재생과 "다시 듣기" 버튼 둘 다 이걸 써서 동작이 일관되게 한다.
  const playFullReplay = (start: number, end: number) => {
    clearReplayTimers()
    setReplayCountdown(null)
    setReplayCurrentText(null)
    const replayBuffer = replayBufferRef.current
    const usesSeparateReplay = replayAudioSrc !== undefined && replayBuffer !== null
    const playbackStart = usesSeparateReplay ? 0 : start
    const playbackEnd = usesSeparateReplay ? replayBuffer.duration : end
    const started = playBufferRange(usesSeparateReplay ? replayBuffer : bufferRef.current, playbackStart, playbackEnd)
    if (!started) return
    const ctx = audioCtxRef.current
    const startedAtCtx = ctx?.currentTime ?? 0
    const tick = () => {
      const c = audioCtxRef.current
      if (!c) return
      // 별도 음원은 첫 가사의 시작점을 0초로 본다. 원곡 타임코드로 관리되는 가사 강조도
      // 같은 상대 시간만큼 이동시켜 기존처럼 표시한다.
      const absoluteTime = start + (c.currentTime - startedAtCtx)
      const seg = segments.find((s) => absoluteTime >= s.start && absoluteTime < s.end)
      if (seg) setReplayCurrentText(seg.text)
    }
    tick()
    replayIntervalRef.current = window.setInterval(tick, 120)
    replayEndTimeoutRef.current = window.setTimeout(
      () => {
        if (replayIntervalRef.current !== null) window.clearInterval(replayIntervalRef.current)
        replayIntervalRef.current = null
        replayEndTimeoutRef.current = null
        setReplayCurrentText(null)
      },
      (playbackEnd - playbackStart) * 1000,
    )
  }

  // 바닥+양옆 벽을 가진 물리 월드를 준비하고, 매 프레임 시뮬레이션 결과를 DOM에 직접 반영하는
  // 루프를 시작한다. 위치를 React state가 아니라 ref로 들고 있는 이유: 60fps로 갱신되는 값인데
  // 매번 리렌더를 거치면 낭비가 크다 — 실제로 화면 구조(단어 추가/텍스트/색상)가 바뀔 때만
  // state를 쓴다.
  const ensureWorld = () => {
    if (engineRef.current) return engineRef.current
    const width = floorRef.current?.clientWidth ?? 320
    const height = floorRef.current?.clientHeight ?? 400
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.55 },
      // 쉬는(정지한) 바디는 시뮬레이션에서 빼서 이미 자리 잡은 가사가 나중에 갑자기 들썩이는
      // 걸 막는다. positionIterations/velocityIterations도 기본값(6/4)보다 올려서 여러 개가
      // 겹쳐 쌓일 때 살짝 파고들었다 튕겨나오는(포지션 보정 튐) 걸 줄인다.
      enableSleeping: true,
      positionIterations: 10,
      velocityIterations: 8,
    })
    // Matter.js는 중력을 sleeping 판정의 움직임으로 계산하지 않아서, 벽에 부딪혀 속도가 잠깐
    // 줄어든 글자를 공중에서 잠재울 수 있다. 옆 벽과 계속 맞닿아 있고 아직 바닥 위라면 깨워서
    // 중력이 다시 적용되게 한다. 바닥에 도착한 글자는 건드리지 않아 쌓인 뒤의 안정성은 유지한다.
    Matter.Events.on(engine, 'collisionActive', (event) => {
      const floorHeight = floorRef.current?.clientHeight ?? height
      event.pairs.forEach((pair) => {
        const sideWall =
          pair.bodyA.label === 'lyrics-side-wall'
            ? pair.bodyA
            : pair.bodyB.label === 'lyrics-side-wall'
              ? pair.bodyB
              : null
        if (!sideWall) return
        const word = pair.bodyA === sideWall ? pair.bodyB : pair.bodyA
        if (!word.isStatic && word.bounds.max.y < floorHeight - 2) Matter.Sleeping.set(word, false)
      })
    })
    const groundOptions = { isStatic: true, friction: 0.4, restitution: 0 }
    const sideWallOptions = {
      isStatic: true,
      friction: 0,
      frictionStatic: 0,
      restitution: 0,
      label: 'lyrics-side-wall',
    }
    const ground = Matter.Bodies.rectangle(width / 2, height + 10, width * 2, 20, groundOptions)
    const left = Matter.Bodies.rectangle(-10, height / 2, 20, height * 3, sideWallOptions)
    const right = Matter.Bodies.rectangle(width + 10, height / 2, 20, height * 3, sideWallOptions)
    Matter.World.add(engine.world, [ground, left, right])
    wallsRef.current = { ground, left, right }
    lastFloorSizeRef.current = { width, height }
    engineRef.current = engine

    // 고정 타임스텝으로 돌린다 — rAF가 준 델타를 그대로 한 번에 넘기면(특히 텝 전환/버벅임 후
    // 큰 델타가 들어올 때) 물리 솔버가 불안정해져서 쌓여있던 가사가 바닥을 한 번 더 치는 것처럼
    // 튀는 원인이 된다. 16.6ms 단위로 쪼개 여러 번 스텝을 밟는다.
    const FIXED_DELTA = 1000 / 60
    let last = performance.now()
    let accumulator = 0
    const tick = (time: number) => {
      accumulator += Math.min(time - last, 100)
      last = time
      let steps = 0
      while (accumulator >= FIXED_DELTA && steps < 5) {
        Matter.Engine.update(engine, FIXED_DELTA)
        accumulator -= FIXED_DELTA
        steps++
      }
      bodiesRef.current.forEach((body, key) => {
        const el = elementsRef.current.get(key)
        if (!el) return
        el.style.transform = `translate(${body.position.x - el.offsetWidth / 2}px, ${body.position.y - el.offsetHeight / 2}px) rotate(${body.angle}rad)`
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return engine
  }

  const resetWorld = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    engineRef.current = null
    wallsRef.current = null
    lastFloorSizeRef.current = null
    bodiesRef.current.clear()
    elementsRef.current.clear()
  }

  // 정타 처리된 가사를 화면 위쪽 중앙 부근에서 수평으로 떨어뜨린다. 좌우 관성을 주는 대신
  // 생성 위치에만 작은 랜덤 오프셋을 적용해, 각 가사가 서로 다른 지점으로 곧게 낙하하면서
  // 일자 탑이 되지 않고 자연스럽게 쌓이게 한다.
  const dropWord = (text: string, key: string): { width: number; height: number } => {
    if (!measureCtxRef.current) {
      measureCtxRef.current = document.createElement('canvas').getContext('2d')
      if (measureCtxRef.current) measureCtxRef.current.font = STACK_FONT
    }
    const textWidth = measureCtxRef.current ? measureCtxRef.current.measureText(text).width : text.length * 11
    const width = textWidth + WORD_PADDING_X
    const height = WORD_HEIGHT

    const engine = ensureWorld()
    const containerWidth = floorRef.current?.clientWidth ?? 320
    // 고정 픽셀 범위는 넓은 화면에서 사실상 한 지점과 같아져 탑이 만들어진다. 화면 너비에
    // 비례한 중앙 영역에 분산해 떨어뜨리되, 글자가 벽 밖에서 생성되지는 않게 제한한다.
    const maxSpawnOffset = Math.min(containerWidth * 0.2, Math.max((containerWidth - width) / 2, 0))
    const x = containerWidth / 2 + (Math.random() * 2 - 1) * maxSpawnOffset
    const y = -40

    const body = Matter.Bodies.rectangle(x, y, width, height, {
      angle: 0,
      restitution: 0,
      friction: 0.15,
      frictionAir: 0.015,
      density: 0.0015,
      chamfer: { radius: 3 },
      sleepThreshold: 120,
    })
    Matter.Body.setVelocity(body, { x: 0, y: 0 })
    Matter.World.add(engine.world, body)
    bodiesRef.current.set(key, body)

    return { width, height }
  }

  const handleStart = async () => {
    stopPlayback()
    const loadGeneration = ++loadGenerationRef.current
    setPhase('loading')
    setLoadProgress(0)
    try {
      if (!audioCtxRef.current) {
        const ctx = new AudioContext()
        const gain = ctx.createGain()
        gain.gain.value = muted ? 0 : 1
        gain.connect(ctx.destination)
        audioCtxRef.current = ctx
        gainRef.current = gain
      }
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume()
      if (!bufferRef.current) {
        // 실제 다운로드 진행률을 보여주려고 arrayBuffer()로 한 번에 받는 대신 스트림을 직접
        // 읽는다. 디코딩(decodeAudioData)은 네이티브 진행률 콜백이 없어서 표시할 수 없으니,
        // 다운로드가 끝나도 99%까지만 채워두고 디코딩이 실제로 끝난 순간에 100%로 마무리한다.
        const res = await fetch(audioSrc)
        const total = Number(res.headers.get('content-length')) || 0
        const reader = res.body?.getReader()
        let arrayBuffer: ArrayBuffer
        if (reader && total > 0) {
          const chunks: Uint8Array[] = []
          let received = 0
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            if (loadGenerationRef.current === loadGeneration) {
              setLoadProgress(Math.min(Math.round((received / total) * 100), 99))
            }
          }
          const merged = new Uint8Array(received)
          let offset = 0
          for (const chunk of chunks) {
            merged.set(chunk, offset)
            offset += chunk.length
          }
          arrayBuffer = merged.buffer
        } else {
          arrayBuffer = await res.arrayBuffer()
          setLoadProgress(99)
        }
        bufferRef.current = await audioCtxRef.current.decodeAudioData(arrayBuffer)
      }
      if (loadGenerationRef.current !== loadGeneration) return
      if (replayAudioSrc && !replayBufferRef.current) {
        setLoadProgress(99)
        const replayResponse = await fetch(replayAudioSrc)
        if (!replayResponse.ok) throw new Error(`완료 재생 음원 로드 실패: ${replayResponse.status}`)
        replayBufferRef.current = await audioCtxRef.current.decodeAudioData(await replayResponse.arrayBuffer())
      }
      if (loadGenerationRef.current !== loadGeneration) return
      setLoadProgress(100)
      setIndex(0)
      setValue('')
      setStacked([])
      resetWorld()
      activeSegmentRef.current = segments[0] ?? null
      setMatchedColor(null)
      setReadyColor(null)
      isHoldingRef.current = false
      wasCorrectRef.current = false
      setWrongInputShaking(false)
      setEnterIconShaking(false)
      setReplayCountdown(null)
      setReplayCurrentText(null)
      setPhase('playing')
      requestAnimationFrame(() => inputRef.current?.focus())
    } catch (e) {
      if (loadGenerationRef.current !== loadGeneration) return
      console.error('가사 게임 오디오 로드 실패', e)
      setPhase('idle')
    }
  }

  const handleRestart = () => {
    loadGenerationRef.current += 1
    stopPlayback()
    if (matchHoldTimeoutRef.current !== null) window.clearTimeout(matchHoldTimeoutRef.current)
    if (enterReminderTimeoutRef.current !== null) window.clearTimeout(enterReminderTimeoutRef.current)
    matchHoldTimeoutRef.current = null
    enterReminderTimeoutRef.current = null
    setPhase('idle')
    setIndex(0)
    setValue('')
    setStacked([])
    resetWorld()
    activeSegmentRef.current = segments[0] ?? null
    setMatchedColor(null)
    setReadyColor(null)
    isHoldingRef.current = false
    wasCorrectRef.current = false
    setWrongInputShaking(false)
    setEnterIconShaking(false)
    setReplayCountdown(null)
    setReplayCurrentText(null)
  }

  // Enter로 정답을 확정하는 순간 소리는 바로 재생한다. 인풋 글자는 정답 색으로 아주 잠깐
  // 보인 뒤(MATCH_HOLD_MS) 사라지면서 낙하한다. 음원까지 이 시간만큼 기다리게 하면 짧은
  // 지연도 사용자에게는 재생 오류처럼 느껴질 수 있어 소리와 낙하 시작 시점만 분리한다.
  const commitSegment = () => {
    const segment = activeSegmentRef.current
    if (!segment || isHoldingRef.current) return
    isHoldingRef.current = true

    const color = readyColor ?? STACK_COLORS[Math.floor(Math.random() * STACK_COLORS.length)]
    setMatchedColor(color)
    playRange(segment.start, segment.end)

    matchHoldTimeoutRef.current = window.setTimeout(() => {
      matchHoldTimeoutRef.current = null
      finalizeSegment(segment, color)
    }, MATCH_HOLD_MS)
  }

  const finalizeSegment = (segment: LyricsSegment, color: StackColor) => {
    const key = `${segment.id}-${Date.now()}`
    const { width, height } = dropWord(segment.text, key)
    setStacked((prev) => [...prev, { key, text: segment.text, color, width, height }])
    setValue('')
    // setValue('')만으로는 부족할 때가 있다 — compositionend 직후 브라우저가 들고 있는 실제
    // <input> DOM 값을 강제로 같이 비워서, React 리렌더를 기다리다 생기는 시차 없이 즉시 지운다.
    if (inputRef.current) inputRef.current.value = ''
    setInputGen((g) => g + 1)
    setMatchedColor(null)
    setReadyColor(null)
    isHoldingRef.current = false
    wasCorrectRef.current = false

    const nextIndex = segments.findIndex((s) => s.id === segment.id) + 1
    const next = nextIndex > 0 ? segments[nextIndex] : undefined
    if (!next) {
      activeSegmentRef.current = null
      const first = segments[0]
      // 마지막 구간 자체의 사운드를 바로 위에서 막 재생을 시작했다 — 그 사운드가 끝나기 전에
      // 전체 흐름 재생이 시작되면 둘이 겹쳐 들린다. 재생 시간(+숨 고르는 여유)만큼 기다렸다가 재생한다.
      const lastClipMs = (segment.end - segment.start) * 1000
      const delay = lastClipMs + REPLAY_BUFFER_MS
      setReplayCountdown(Math.ceil(delay / 1000))
      autoReplayTimeoutRef.current = window.setTimeout(() => {
        autoReplayTimeoutRef.current = null
        setReplayCountdown(null)
        playFullReplay(first.start, segment.end)
      }, delay)
      setPhase('done')
      return
    }
    activeSegmentRef.current = next
    setIndex(nextIndex)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Enter 직후 한글 IME가 이전 input 노드를 향해 늦은 이벤트를 보내는 경우가 있다. 이벤트의
    // 문자열이 전체 이전 가사일 수도, 마지막 음절 하나일 수도 있으므로 값으로 추측하지 않고
    // 현재 ref가 가리키는 새 input에서 발생한 이벤트인지 직접 확인한다.
    if (isHoldingRef.current || e.currentTarget !== inputRef.current) return
    const next = e.target.value
    setValue(next)
    const segment = activeSegmentRef.current
    const isCorrect = segment !== null && normalizeLyrics(next) === normalizeLyrics(segment.text)
    if (isCorrect && !wasCorrectRef.current) {
      setReadyColor(STACK_COLORS[Math.floor(Math.random() * STACK_COLORS.length)])
      if (enterReminderTimeoutRef.current !== null) window.clearTimeout(enterReminderTimeoutRef.current)
      enterReminderTimeoutRef.current = null
      setEnterIconShaking(true)
    } else if (!isCorrect) {
      setReadyColor(null)
      if (enterReminderTimeoutRef.current !== null) window.clearTimeout(enterReminderTimeoutRef.current)
      enterReminderTimeoutRef.current = null
      setEnterIconShaking(false)
    }
    wasCorrectRef.current = isCorrect
  }

  const submitLyrics = (enteredText: string) => {
    const segment = activeSegmentRef.current
    if (!segment || normalizeLyrics(enteredText) !== normalizeLyrics(segment.text)) {
      setWrongInputShaking(true)
      return
    }

    // PC 한글 IME에서는 마지막 글자가 아직 조합 중이어도 Enter keydown 시점의 DOM 값에는
    // 완성된 글자가 들어 있다. 그 값을 기준으로 한 번만 확정하고, 뒤따르는 이전 input 이벤트는
    // input key 교체와 DOM 노드 비교로 다음 입력창에 넘어오지 못하게 한다.
    if (enterReminderTimeoutRef.current !== null) window.clearTimeout(enterReminderTimeoutRef.current)
    enterReminderTimeoutRef.current = null
    setEnterIconShaking(false)
    commitSegment()
  }

  const handleEnterShakeEnd = () => {
    setEnterIconShaking(false)
    if (!wasCorrectRef.current || isHoldingRef.current) return
    if (enterReminderTimeoutRef.current !== null) window.clearTimeout(enterReminderTimeoutRef.current)
    enterReminderTimeoutRef.current = window.setTimeout(() => {
      enterReminderTimeoutRef.current = null
      if (wasCorrectRef.current && !isHoldingRef.current) setEnterIconShaking(true)
    }, ENTER_REMINDER_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    submitLyrics(e.currentTarget.value)
  }

  return (
    <div
      className={classNames(
        'relative w-full h-full flex flex-col items-center',
        (phase === 'playing' || phase === 'done') && 'lyrics-game-active',
      )}
    >
      <div
        className={classNames(
          'w-full flex flex-row items-center justify-between px-3 py-2',
          (phase === 'playing' || phase === 'done') && 'absolute inset-x-0 -top-14 z-20',
        )}
      >
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label='음소거'
          className={classNames('p-2 text-lg', commonTransition)}
        >
          {muted ? <VolumeOffIcon className='w-6 h-6' /> : <VolumeOnIcon className='w-6 h-6' />}
        </button>
        <span className='text-[16.8px]'>Layering Game</span>
        <button onClick={handleRestart} aria-label='다시하기' className={classNames('p-2 text-lg', commonTransition)}>
          <ReloadIcon className='w-6 h-6' />
        </button>
      </div>

      <div className='relative w-full flex-1'>
        {phase === 'idle' || phase === 'loading' ? (
          <div className='w-full h-full flex flex-col items-center justify-center gap-5 px-10 text-center'>
            <div className='flex -mt-12 flex-col items-center gap-3'>
              <p className='text-[15px] leading-relaxed'>
                소란의 신곡 &apos;이별직전&apos;을 <br />
                Layering Game을 통해 미리 들어보세요!
              </p>
              <p className='text-[13px] leading-relaxed'>
                가사를 입력한 뒤 엔터를 누르면 노래가 재생됩니다. <br />
                원활한 감상을 위해 무음 모드를 해제해 주세요.
              </p>
            </div>
            {phase === 'loading' ? (
              <div className='w-40 flex flex-col items-center gap-2'>
                <div className='w-full h-1.5 border border-primary overflow-hidden'>
                  <div
                    className='h-full bg-primary transition-[width] duration-150 ease-out'
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <span className='text-[14px] text-primary/60'>불러오는 중... {loadProgress}%</span>
              </div>
            ) : (
              <button
                onClick={handleStart}
                className={classNames('px-5 py-2 bg-primary font-bold text-white text-[15px]', commonTransition)}
              >
                START
              </button>
            )}
          </div>
        ) : (
          <>
            <div ref={floorRef} className='absolute inset-x-0 top-24 overflow-hidden' style={{ bottom: keyboardInset }}>
              {stacked.map((w) => (
                <span
                  key={w.key}
                  ref={(el) => {
                    if (el) elementsRef.current.set(w.key, el)
                    else elementsRef.current.delete(w.key)
                  }}
                  className={classNames(
                    'absolute top-0 left-0 flex items-center justify-center text-[14px] whitespace-nowrap select-none',
                    COLOR_CLASS[w.color],
                  )}
                  style={{ width: w.width, height: w.height, willChange: 'transform' }}
                >
                  {w.text}
                </span>
              ))}
            </div>

            <div className='absolute top-0 inset-x-0 h-full min-h-24 z-10 flex flex-col items-center justify-start gap-3 px-10'>
              {phase === 'playing' && (
                <div className='w-full h-fit py-4 flex flex-col justify-center items-center gap-3'>
                  <p className='text-[15px] text-primary'>{current.text}</p>
                  <div className='relative w-3/5 max-w-[240px] min-w-[120px]'>
                    <input
                      key={inputGen}
                      ref={inputRef}
                      value={value}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      readOnly={matchedColor !== null}
                      className={classNames(
                        'w-full border border-primary/30 px-10 py-1.5 text-center text-[15px]',
                        inputColor ? COLOR_CLASS[inputColor] : 'text-black',
                        wrongInputShaking && 'animate-lyrics-text-shake motion-reduce:animate-none',
                      )}
                      onAnimationEnd={() => setWrongInputShaking(false)}
                      autoFocus
                      autoComplete='off'
                      autoCorrect='off'
                      autoCapitalize='off'
                      spellCheck={false}
                    />
                    {value.length > 0 && (
                      <button
                        type='button'
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => submitLyrics(inputRef.current?.value ?? value)}
                        disabled={matchedColor !== null}
                        aria-label='입력 완료'
                        className={classNames(
                          'absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-primary/50 disabled:cursor-default',
                          commonTransition,
                        )}
                      >
                        <FiCornerDownLeft
                          className={classNames(
                            'h-4 w-4',
                            enterIconShaking && 'animate-lyrics-shake motion-reduce:animate-none',
                          )}
                          onAnimationEnd={handleEnterShakeEnd}
                          aria-hidden='true'
                        />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {phase === 'done' && (
                <div className='flex h-full  flex-col justify-start py-10 items-center gap-4'>
                  <p className='text-[15px]'>
                    소란(SORAN) EP [Layer] <br />
                    26.09.18 6PM (KST)
                  </p>

                  <div className='w-full h-fit  flex flex-row justify-center items-center gap-2'>
                    <button
                      onClick={() => playFullReplay(segments[0].start, segments[segments.length - 1].end)}
                      className={classNames('px-4 py-1.5 border border-primary text-[14px] bg-white', commonTransition)}
                    >
                      다시 듣기
                    </button>
                    <button
                      onClick={handleRestart}
                      className={classNames(
                        'px-4 py-1.5 border border-primary bg-primary text-white text-[14px]',
                        commonTransition,
                      )}
                    >
                      다시 하기
                    </button>
                  </div>
                  <div className='w-full h-fit  flex flex-col justify-start items-center gap-2'>
                    {replayCountdown !== null && replayCountdown > 0 && (
                      <p className='text-[14px] text-primary/60'>{replayCountdown}초 뒤 전체 재생됩니다...</p>
                    )}
                    {replayCurrentText !== null && <p className='text-[14px] text-primary/60'>{replayCurrentText}</p>}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
