'use client'

import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import classNames from 'classnames'
import VolumeOnIcon from '@/svg/volumeOn.svg'
import VolumeOffIcon from '@/svg/volumeOff.svg'
import ReloadIcon from '@/svg/reload.svg'
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

const STACK_FONT = "12px 'Sandoll DanpyunsunB', sans-serif"
const WORD_PADDING_X = 14
const WORD_HEIGHT = 24
// 정타 판정 → 인풋 글자에 색이 입혀진 채 잠깐 머무름 → 인풋에서 사라짐과 동시에 그 색을 가진
// 채로 낙하 시작, 순서로 보여주기 위한 대기 시간.
const MATCH_HOLD_MS = 280

// 타이틀곡 원곡 하나를 통째로 디코딩해두고, 정타 시 구간(start~end)만 잘라 재생한다.
// <audio> currentTime seek 대신 Web Audio API를 쓰는 이유: 아주 짧은 구간을 촘촘히 이어
// 재생해야 하는데, seek 기반 재생은 특히 iOS Safari에서 탐색 지연으로 구간이 밀리거나 끊긴다.
export const LayeringGame = ({ segments, audioSrc }: { segments: LyricsSegment[]; audioSrc: string }) => {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing' | 'done'>('idle')
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [stacked, setStacked] = useState<StackedWord[]>([])
  const [muted, setMuted] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  // 정타 판정 직후 ~ 실제로 인풋을 비우고 낙하시키기 전까지, 인풋 글자에 입혀둘 색.
  const [matchedColor, setMatchedColor] = useState<StackColor | null>(null)
  // 정타마다 값이 바뀐다 — <input>의 key로 써서 구간이 넘어갈 때마다 인풋 DOM 노드를 통째로
  // 새로 만든다. 이전 노드에 남아있을 수 있는 IME 조합 버퍼나, 그 노드를 향해 아직 날아오고
  // 있는 트레일링 이벤트를 텍스트 비교 같은 걸로 하나하나 걸러내지 않고 통째로 무효화한다.
  const [inputGen, setInputGen] = useState(0)
  // 모바일 키보드가 올라오면 그만큼 바닥 영역이 가려진다. visualViewport로 키보드가 가린
  // 높이(inset)를 감지해서 바닥 컨테이너의 bottom을 그만큼 띄워 보이게 한다.
  const [keyboardInset, setKeyboardInset] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  // 지금 맞춰야 할 구간을 React state(index)가 아니라 ref로도 따로 들고 있는다. 한글 IME는
  // compositionend 직후 브라우저가 트레일링 input 이벤트를 한 번 더 보낼 때가 있는데, 이게
  // React가 리렌더로 handleChange를 최신 index로 교체하기 *전에* 오는 경우 이전 index를 보던
  // 낡은 클로저가 다시 실행돼서 방금 넘긴 구간을 한 번 더 정타 처리해버린다(= 다음 구간이
  // 건너뛰어지고 인풋엔 방금 지운 텍스트가 되돌아와 남아있는 것처럼 보임). ref는 리렌더를
  // 기다리지 않고 commitSegment 안에서 그 자리에서 바로 갱신되니 이 경쟁 상태를 원천적으로 막는다.
  const activeSegmentRef = useRef<LyricsSegment | null>(segments[0] ?? null)
  // 방금 커밋한(=다음 구간으로 넘어간) 텍스트. 위 트레일링 input 이벤트는 activeSegmentRef
  // 덕분에 "다시 커밋"되진 않지만, handleChange가 그 이벤트의 값을 그대로 setValue로
  // 반영해버리면 화면엔 방금 지운 이전 가사가 잠깐이 아니라 계속 남아있는 것처럼 보인다.
  // 그 트레일링 이벤트의 값이 "방금 커밋한 텍스트와 정확히 같다"는 걸로 걸러내서 아예 무시한다.
  const justClearedTextRef = useRef<string | null>(null)
  // 정타 판정 ~ 실제 낙하 시작 사이의 짧은 대기 구간 안에 있는지. state(matchedColor)는 비동기라
  // 그 틈에 트레일링 이벤트가 한 번 더 들어오면 commitSegment가 중복 실행될 수 있어서 ref로 막는다.
  const isHoldingRef = useRef(false)

  const floorRef = useRef<HTMLDivElement>(null)
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const bodiesRef = useRef<Map<string, Matter.Body>>(new Map())
  const elementsRef = useRef<Map<string, HTMLSpanElement>>(new Map())
  const rafRef = useRef<number | null>(null)
  const keyboardInsetRef = useRef(0)
  // 키보드가 없을 때 바닥 컨테이너의 실제 하단 y좌표(뷰포트 기준). 바닥 아래에는 소셜 아이콘
  // 푸터/패딩이 더 있어서 바닥의 "원래 하단"은 페이지 전체의 바닥보다 한참 위에 있다 — 그래서
  // 페이지 전체 기준으로 키보드가 가린 높이를 그대로 밀어올리면 이미 안 가려지는 부분까지
  // 같이 밀어올려서 필요 이상으로 높이 튀는 문제가 있었다. 바닥 자신의 원래 위치를 기준으로
  // 삼아야 정확히 "실제로 가려지는 만큼만" 밀어올릴 수 있다.
  const floorNaturalBottomRef = useRef<number | null>(null)

  useEffect(() => {
    const ctx = audioCtxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return
    gain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime)
  }, [muted])

  // 바닥(ground/walls)과 이미 쌓인 가사들을 통째로 delta만큼 위/아래로 옮긴다. 다시 중력으로
  // 떨어뜨려 재정렬하는 게 아니라 좌표계 자체를 살짝 미는 것이라, 키보드가 열리고 닫힐 때마다
  // 이미 멈춰있던 파일이 다시 들썩이지 않는다.
  const applyKeyboardInset = (inset: number) => {
    const delta = inset - keyboardInsetRef.current
    if (delta !== 0 && engineRef.current) {
      Matter.Composite.translate(engineRef.current.world, { x: 0, y: -delta })
    }
    keyboardInsetRef.current = inset
    setKeyboardInset(inset)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    // PC(마우스/트랙패드)에는 가상 키보드가 없다 — 브라우저 창을 세로로 줄이거나 Ctrl+휠로
    // 확대/축소해도 visualViewport는 똑같이 줄어들어서, 이 로직을 데스크톱에도 그대로 붙이면
    // 창 크기 변경/줌을 키보드로 오인해 바닥이 튀어 오른다. 주 입력 방식이 터치인 기기에서만 붙인다.
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const vv = window.visualViewport
    // 툴바 접힘 같은 사소한 높이 변화까지 키보드로 오인하지 않도록 어느 정도 큰 변화만 반영.
    const KEYBOARD_THRESHOLD = 80
    const handleResize = () => {
      const baseline = floorNaturalBottomRef.current
      if (baseline == null) return
      // 바닥의 원래 하단이 지금 보이는 뷰포트 높이보다 아래에 있는 만큼만 = 실제로 키보드에
      // 가려지는 만큼만 밀어올린다. body가 overflow:hidden이라 스크롤 오프셋은 신경 안 써도 된다.
      const overlap = baseline - vv.height
      applyKeyboardInset(overlap > KEYBOARD_THRESHOLD ? Math.round(overlap) : 0)
    }
    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (phase === 'playing' && floorRef.current && floorNaturalBottomRef.current == null) {
      floorNaturalBottomRef.current = floorRef.current.getBoundingClientRect().bottom
    }
    if (phase === 'idle') floorNaturalBottomRef.current = null
  }, [phase])

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const current = segments[index]

  const playRange = (start: number, end: number) => {
    const ctx = audioCtxRef.current
    const buffer = bufferRef.current
    const gain = gainRef.current
    const duration = end - start
    if (!ctx || !buffer || !gain || duration <= 0) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    source.start(0, start, duration)
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
    const wallOptions = { isStatic: true, friction: 0.6, restitution: 0 }
    Matter.World.add(engine.world, [
      Matter.Bodies.rectangle(width / 2, height + 10, width * 2, 20, wallOptions),
      Matter.Bodies.rectangle(-10, height / 2, 20, height * 3, wallOptions),
      Matter.Bodies.rectangle(width + 10, height / 2, 20, height * 3, wallOptions),
    ])
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
    bodiesRef.current.clear()
    elementsRef.current.clear()
  }

  // 정타 처리된 가사를 물리 바디로 만들어 화면 위쪽 밖에서 떨어뜨린다. 살짝 랜덤한 초기 각도와
  // 회전/수평 속도를 줘야 바닥이나 다른 가사 위에 떨어질 때 자연스럽게 기울며 자리를 잡는다.
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
    const x = width / 2 + Math.random() * Math.max(containerWidth - width, 0)
    const y = -40 - Math.random() * 30

    const body = Matter.Bodies.rectangle(x, y, width, height, {
      angle: (Math.random() - 0.5) * 0.6,
      restitution: 0,
      friction: 0.6,
      frictionAir: 0.012,
      density: 0.0015,
    })
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12)
    Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.2, y: 0 })
    Matter.World.add(engine.world, body)
    bodiesRef.current.set(key, body)

    return { width, height }
  }

  const handleStart = async () => {
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
            setLoadProgress(Math.min(Math.round((received / total) * 100), 99))
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
        setLoadProgress(100)
      } else {
        setLoadProgress(100)
      }
      setIndex(0)
      setValue('')
      setStacked([])
      resetWorld()
      activeSegmentRef.current = segments[0] ?? null
      justClearedTextRef.current = null
      setMatchedColor(null)
      isHoldingRef.current = false
      setPhase('playing')
      requestAnimationFrame(() => inputRef.current?.focus())
    } catch (e) {
      console.error('가사 게임 오디오 로드 실패', e)
      setPhase('idle')
    }
  }

  const handleRestart = () => {
    setPhase('idle')
    setIndex(0)
    setValue('')
    setStacked([])
    resetWorld()
    activeSegmentRef.current = segments[0] ?? null
    setMatchedColor(null)
    isHoldingRef.current = false
  }

  // 정타 판정 → (색이 입혀진 채 인풋에 잠깐 머무름) → 인풋에서 사라짐과 동시에 그 색을 가진
  // 채로 낙하 시작, 순서로 보여주려고 정타 처리를 두 단계로 나눴다. 오디오는 정타 즉시(반응성),
  // 인풋 비우기·물리 낙하는 MATCH_HOLD_MS 뒤(연출)에 실행한다.
  const commitSegment = () => {
    const segment = activeSegmentRef.current
    if (!segment || isHoldingRef.current) return
    isHoldingRef.current = true

    playRange(segment.start, segment.end)
    const color = STACK_COLORS[Math.floor(Math.random() * STACK_COLORS.length)]
    setMatchedColor(color)

    window.setTimeout(() => finalizeSegment(segment, color), MATCH_HOLD_MS)
  }

  const finalizeSegment = (segment: LyricsSegment, color: StackColor) => {
    const key = `${segment.id}-${Date.now()}`
    const { width, height } = dropWord(segment.text, key)
    setStacked((prev) => [...prev, { key, text: segment.text, color, width, height }])
    setValue('')
    // setValue('')만으로는 부족할 때가 있다 — compositionend 직후 브라우저가 들고 있는 실제
    // <input> DOM 값을 강제로 같이 비워서, React 리렌더를 기다리다 생기는 시차 없이 즉시 지운다.
    if (inputRef.current) inputRef.current.value = ''
    justClearedTextRef.current = segment.text
    setInputGen((g) => g + 1)
    setMatchedColor(null)
    isHoldingRef.current = false

    const nextIndex = segments.findIndex((s) => s.id === segment.id) + 1
    const next = nextIndex > 0 ? segments[nextIndex] : undefined
    if (!next) {
      activeSegmentRef.current = null
      const first = segments[0]
      window.setTimeout(() => playRange(first.start, segment.end), 400)
      setPhase('done')
      return
    }
    activeSegmentRef.current = next
    setIndex(nextIndex)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    // compositionend로 이미 커밋한 직후, 브라우저가 그 조합이 끝났다는 걸 알리려고 트레일링
    // input 이벤트를 값이 되돌아간 채로 한 번 더 보낼 때가 있다(옛 값 그대로). 그 이벤트를
    // 정상 타이핑으로 착각해서 setValue로 반영하면 화면에 방금 지운 이전 가사가 남아있는
    // 것처럼 보인다 — 방금 커밋한 텍스트와 완전히 같은 값이면 무시한다.
    if (justClearedTextRef.current !== null) {
      if (next === justClearedTextRef.current) {
        if (inputRef.current) inputRef.current.value = ''
        return
      }
      justClearedTextRef.current = null
    }

    setValue(next)
    // 한글 IME는 마지막 글자가 조합 중인 상태로 onChange가 먼저 올 때가 있다. 이때 정타로
    // 판정해서 지워버리면, 브라우저가 들고 있는 조합 버퍼는 지워지지 않고 남아서 다음 구간
    // 입력에 이전 글자가 섞여 보인다. compositionend까지 판정을 미룬다.
    if (composingRef.current || (e.nativeEvent as InputEvent).isComposing) return
    if (activeSegmentRef.current && next.trim() === activeSegmentRef.current.text) commitSegment()
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    const value = e.currentTarget.value
    if (activeSegmentRef.current && value.trim() === activeSegmentRef.current.text) commitSegment()
  }

  return (
    <div className='w-full h-full flex flex-col items-center'>
      <div className='w-full flex flex-row items-center justify-between px-3 py-2'>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label='음소거'
          className={classNames('p-2 text-lg', commonTransition)}
        >
          {muted ? <VolumeOffIcon className='w-6 h-6' /> : <VolumeOnIcon className='w-6 h-6' />}
        </button>
        <span className='text-sm'>Layering Game</span>
        <button onClick={handleRestart} aria-label='다시하기' className={classNames('p-2 text-lg', commonTransition)}>
          <ReloadIcon className='w-6 h-6' />
        </button>
      </div>

      <div className='relative w-full flex-1'>
        {phase === 'idle' || phase === 'loading' ? (
          <div className='w-full h-full flex flex-col items-center justify-center gap-5 px-10 text-center'>
            <p className='text-sm leading-relaxed'>
              소란의 신곡을
              <br />
              가사 레이어링을 통해 들어보자!
            </p>
            {phase === 'loading' ? (
              <div className='w-40 flex flex-col items-center gap-2'>
                <div className='w-full h-1.5 border border-primary overflow-hidden'>
                  <div
                    className='h-full bg-primary transition-[width] duration-150 ease-out'
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <span className='text-xs text-primary/60'>불러오는 중... {loadProgress}%</span>
              </div>
            ) : (
              <button
                onClick={handleStart}
                className={classNames('px-5 py-2 bg-primary font-bold text-white text-sm', commonTransition)}
              >
                START
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 타이핑을 마친 가사가 물리 시뮬레이션으로 떨어져 쌓이는 바닥 영역. 헤더가 항상
                h-24로 고정 높이라 top-24로 겹치지 않게 나눠둘 수 있다. */}
            <div
              ref={floorRef}
              className='absolute inset-x-0 bottom-0 top-24 overflow-hidden transition-[bottom] duration-200 ease-out'
              style={{ bottom: keyboardInset }}
            >
              {stacked.map((w) => (
                <span
                  key={w.key}
                  ref={(el) => {
                    if (el) elementsRef.current.set(w.key, el)
                    else elementsRef.current.delete(w.key)
                  }}
                  className={classNames(
                    'absolute top-0 left-0 flex items-center justify-center text-xs whitespace-nowrap select-none',
                    COLOR_CLASS[w.color],
                  )}
                  style={{ width: w.width, height: w.height, willChange: 'transform' }}
                >
                  {w.text}
                </span>
              ))}
            </div>

            <div className='absolute top-0 inset-x-0 h-24 z-10 flex flex-col items-center justify-center gap-3 px-10'>
              {phase === 'playing' && (
                <>
                  <p className='text-sm text-primary'>{current.text}</p>
                  <input
                    key={inputGen}
                    ref={inputRef}
                    value={value}
                    onChange={handleChange}
                    onCompositionStart={() => {
                      composingRef.current = true
                    }}
                    onCompositionEnd={handleCompositionEnd}
                    readOnly={matchedColor !== null}
                    className={classNames(
                      'w-3/5 border border-primary/30 text-center py-1.5 text-sm bg-white',
                      matchedColor ? COLOR_CLASS[matchedColor] : 'text-black',
                    )}
                    autoFocus
                    autoComplete='off'
                    autoCorrect='off'
                    autoCapitalize='off'
                    spellCheck={false}
                  />
                </>
              )}
              {phase === 'done' && (
                <div className='flex flex-col items-center gap-3'>
                  <p className='text-sm'>수고했어요 :)</p>
                  <button
                    onClick={() => playRange(segments[0].start, segments[segments.length - 1].end)}
                    className={classNames('px-4 py-1.5 border border-primary text-xs bg-white', commonTransition)}
                  >
                    다시 듣기
                  </button>
                  <button
                    onClick={handleRestart}
                    className={classNames(
                      'px-4 py-1.5 border border-primary bg-primary text-white text-xs',
                      commonTransition,
                    )}
                  >
                    다시 하기
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
