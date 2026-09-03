'use client'

import { useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import lyricsData from '../lyrics.json'

const AUDIO_SRC = '/audio/SORAN-이별직전.mp3'
const STORAGE_KEY = 'lyrics-timer-rows'
const RATES = [0.5, 0.75, 1, 1.5]
const STEP_SEC = 0.1
const FINE_RANGE = 1

const formatTime = (sec: number) => {
  if (!Number.isFinite(sec)) return '0:00.00'
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

type Row = { start: number; end: number }

const defaultRows = (): Row[] => lyricsData.segments.map((s) => ({ start: s.start, end: s.end }))

// 임시 내부 도구: 메인 플레이어로 노래를 듣다가 재생/멈춤으로 지금 몇 초인지 확인하고, 그
// 숫자를 각 구간의 start/end 칸에 직접 입력한다. "구간 재생" 버튼으로 지금 입력해둔 start~end가
// 맞는지 그 구간만 재생해서 바로 확인할 수 있다.
export default function LyricsTimerPage() {
  const segments = lyricsData.segments

  const [rows, setRows] = useState<Row[]>(defaultRows)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [copied, setCopied] = useState(false)
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null)
  const [bufferStatus, setBufferStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const audioRef = useRef<HTMLAudioElement>(null)
  // "구간 재생"은 실제 게임(LayeringGame)과 똑같은 Web Audio API로 재생한다. 메인 플레이어의
  // <audio> currentTime seek는 압축 포맷 특성상 정확한 샘플이 아니라 가까운 키프레임으로
  // 스냅될 때가 있어서, 짧은 구간을 이걸로 잘라 재생하면 실제로는 맞는 값인데도 "안 맞는 것
  // 같다"고 느껴질 수 있다. AudioBufferSourceNode.start(0, start, duration)는 디코딩된
  // 원본 샘플에서 정확히 그 구간만 잘라 재생하므로, 여기서 맞다고 들리면 실제 게임에서도 맞다.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const previewTimeoutRef = useRef<number | null>(null)
  // 복원 effect의 setState가 반영되기 전에 저장 effect가 먼저 돌면 방금 읽은 값을 기본값으로
  // 덮어써버린다 — 저장 effect의 첫 실행 한 번만 건너뛰어서 막는다.
  const skipNextPersistRef = useRef(true)

  useEffect(() => {
    // JSX의 onLoadedMetadata/onTimeUpdate prop만으로는 값이 안 들어올 때가 있었다 — 네이티브
    // duration/currentTime은 정상적으로 갱신되는데 React state는 계속 0으로 남는 경우가 있었음
    // (메타데이터 로드나 일시정지 상태의 프로그래밍적 seek처럼, 재생 중이 아닐 때 React가 이
    // 이벤트들을 항상 받는다는 보장이 없어 보인다). ref로 DOM에 직접 리스너를 붙이고, 이펙트가
    // 붙는 시점에 이미 로드가 끝나있으면(readyState) duration을 바로 반영한다.
    const audio = audioRef.current
    if (!audio) return

    const updateDuration = () => setDuration(audio.duration)
    const updateCurrentTime = () => setCurrentTime(audio.currentTime)

    if (audio.readyState >= 1) updateDuration()
    audio.addEventListener('loadedmetadata', updateDuration)
    // timeupdate만으로는 "일시정지 상태에서 currentTime을 코드로 옮기는" 경우(메인/미세 탐색바
    // 드래그, 이전/다음 버튼, 가사 클릭 이동)를 못 잡을 때가 있어서 seeked도 같이 듣는다.
    audio.addEventListener('timeupdate', updateCurrentTime)
    audio.addEventListener('seeked', updateCurrentTime)
    return () => {
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('timeupdate', updateCurrentTime)
      audio.removeEventListener('seeked', updateCurrentTime)
    }
  }, [])

  useEffect(() => {
    // effect 최상단에 직접 두면 react-hooks 린트가 "effect 안에서 동기적으로 setState 호출"로 잡아낸다.
    const restore = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setRows(JSON.parse(saved))
      } catch {
        // 저장된 값이 깨져있으면 그냥 기본값으로 시작
      }
    }
    restore()
  }, [])

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
    } catch {
      // 사파리 프라이빗 모드 등 localStorage를 못 쓰는 환경은 그냥 무시
    }
  }, [rows])

  // "구간 재생"용 원곡을 한 번 디코딩해둔다 (실제 게임과 동일한 방식).
  useEffect(() => {
    let cancelled = false
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    fetch(AUDIO_SRC)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        if (cancelled) return
        bufferRef.current = decoded
        setBufferStatus('ready')
      })
      .catch((e) => {
        console.error('구간 재생용 오디오 디코딩 실패', e)
        if (!cancelled) setBufferStatus('error')
      })
    return () => {
      cancelled = true
      ctx.close()
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }

  // 헤드리스 환경에서 확인해보니, 멈춰있는 상태의 오디오에 currentTime을 코드로 대입해도
  // timeupdate/seeked가 안 붙는 경우가 있었다(네이티브 값은 바뀌는데 그 사실을 알려주는 이벤트가
  // 안 옴). 이벤트가 오길 기다리는 대신, 우리가 직접 currentTime을 옮기는 모든 곳에서 이 함수로
  // DOM 값과 React state(currentTime)를 같이 맞춰준다.
  const seekTo = (time: number) => {
    const audio = audioRef.current
    if (!audio) return
    const clamped = Math.min(Math.max(time, 0), duration || audio.duration || Infinity)
    audio.currentTime = clamped
    setCurrentTime(clamped)
  }

  // 정확한 지점을 찾을 때 재생 중이면 위치만 살짝 옮기고 그대로 흘러가버려서 미세조정이 안 된다
  // — 멈춘 다음 그 지점으로 옮겨서, 눌러본 딱 그 위치에서 다시 재생 버튼을 눌러 확인할 수 있게 한다.
  const stepTime = (delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    seekTo(audio.currentTime + delta)
  }

  const previewRow = (index: number) => {
    const ctx = audioCtxRef.current
    const buffer = bufferRef.current
    if (!ctx || !buffer) return
    const row = rows[index]
    const clipDuration = row.end - row.start
    if (clipDuration <= 0) return

    audioRef.current?.pause() // 메인 플레이어랑 소리가 겹치지 않게
    previewSourceRef.current?.stop() // 이전 미리듣기가 아직 재생 중이면 끊고 새로 시작
    if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current)
    // 마운트 시점(사용자 제스처 없이)에 AudioContext를 만들어서 브라우저 자동재생 정책 때문에
    // suspended 상태로 시작하는 경우가 있다 — 여기(버튼 클릭 = 제스처)서 깨워준다.
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0, row.start, clipDuration)
    previewSourceRef.current = source

    setPreviewingIndex(index)
    // 실제 게임과 동일하게 항상 1배속으로 재생하니, 하이라이트도 그 길이만큼만 유지한다.
    previewTimeoutRef.current = window.setTimeout(() => setPreviewingIndex(null), clipDuration * 1000)
  }

  const setRowValue = (index: number, key: 'start' | 'end', raw: string) => {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        if (key === 'start') {
          // end는 항상 start 이상이어야 한다 — start를 end보다 크게 입력하면 end도 같이 끌어올린다.
          return { start: parsed, end: parsed > row.end ? parsed : row.end }
        }
        return { ...row, end: parsed }
      }),
    )
  }

  const buildExport = () => ({
    day1Range: lyricsData.day1Range,
    segments: segments.map((seg, i) => ({
      id: seg.id,
      text: seg.text,
      start: Math.round(rows[i].start * 100) / 100,
      end: Math.round(rows[i].end * 100) / 100,
    })),
  })

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lyrics.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(buildExport(), null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    if (!window.confirm('입력한 start/end를 전부 원래 값(현재 lyrics.json)으로 되돌릴까요?')) return
    setRows(defaultRows())
  }

  return (
    <div className='fixed inset-0 w-screen checking min-h-dvh flex flex-col items-center gap-4 py-6 px-4 text-black bg-white text-sm'>
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <h1 className='font-bold'>가사 타임코드 찍기 (임시 도구)</h1>
      <p className='text-xs text-black/50 text-center'>
        전체 곡 {segments.length}개 구간(1절~후렴까지 곡 전체) 전부 여기 들어있어요. 재생하다 원하는 지점에서 멈추면
        아래 시간이 멈춘 시점 그대로 표시되니, 그 숫자를 해당 구간의 start/end 칸에 입력하면 됩니다.
        {bufferStatus === 'loading' && ' (구간 재생 준비 중...)'}
        {bufferStatus === 'error' && ' (구간 재생용 오디오 로드 실패 — 새로고침해보세요)'}
      </p>

      {/* 메인 플레이어 */}
      <div className='w-full flex flex-col gap-2 border border-black/20 p-3'>
        <input
          type='range'
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          className='w-full'
        />
        {/* 미세 탐색: 곡 전체(약 3분)를 다 담는 위 탐색바는 한 픽셀이 초 단위로 뭉뚱그려져서
            드래그로는 정밀 조정이 안 된다. 지금 위치를 중심으로 한 좁은 구간(±FINE_RANGE초)만
            보여줘서, 드래그 한 번으로도 훨씬 촘촘하게(ms 단위) 이동할 수 있게 한다. */}
        <div className='flex items-center gap-2'>
          <span className='text-[10px] text-black/40 whitespace-nowrap'>미세 탐색 (±{FINE_RANGE}s)</span>
          <input
            type='range'
            min={Math.max(0, currentTime - FINE_RANGE)}
            max={Math.min(duration || currentTime + FINE_RANGE, currentTime + FINE_RANGE)}
            step={0.001}
            value={currentTime}
            onPointerDown={() => audioRef.current?.pause()}
            onChange={(e) => seekTo(Number(e.target.value))}
            className='w-full'
          />
        </div>
        <div className='flex items-center justify-between'>
          <span className='tabular-nums'>
            {formatTime(currentTime)} / {formatTime(duration)}
            <span className='text-black/40'> ({currentTime.toFixed(2)}초)</span>
          </span>
          <div className='flex items-center gap-2'>
            <button onClick={() => stepTime(-STEP_SEC)} className='px-2 py-1 border border-black/30'>
              ◀ {STEP_SEC}s
            </button>
            <button onClick={togglePlay} className='px-3 py-1 border border-black/30'>
              {isPlaying ? '일시정지' : '재생'}
            </button>
            <button onClick={() => stepTime(STEP_SEC)} className='px-2 py-1 border border-black/30'>
              {STEP_SEC}s ▶
            </button>
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRate(r)
                  if (audioRef.current) audioRef.current.playbackRate = r
                }}
                className={classNames(
                  'px-2 py-1 border',
                  rate === r ? 'border-black bg-black text-white' : 'border-black/30',
                )}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 내보내기 */}
      <div className='flex gap-2'>
        <button onClick={handleDownload} className='px-4 py-2 border border-black/30'>
          JSON 다운로드
        </button>
        <button onClick={handleCopy} className='px-4 py-2 border border-black/30'>
          {copied ? '복사됨!' : 'JSON 복사'}
        </button>
        <button onClick={handleReset} className='px-4 py-2 underline'>
          전체 초기화
        </button>
      </div>

      {/* 구간 목록 */}
      <div className='w-full h-fit overflow-y-auto show-scrollbar border border-black/20'>
        <table className='w-full text-xs'>
          <thead className='sticky top-0 bg-white'>
            <tr className='border-b border-black/20'>
              <th className='text-left p-1'>#</th>
              <th className='text-left p-1'>가사</th>
              <th className='text-left p-1'>start</th>
              <th className='text-left p-1'>end</th>
              <th className='text-left p-1'></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={segments[i].id}
                className={classNames('border-b border-black/10', previewingIndex === i && 'bg-yellow/30')}
              >
                <td className='p-1 text-black/40'>{segments[i].id}</td>
                <td
                  className='p-1 cursor-pointer'
                  onClick={() => {
                    audioRef.current?.pause()
                    seekTo(row.start)
                  }}
                >
                  {segments[i].text}
                </td>
                <td className='p-1'>
                  <input
                    type='number'
                    step={0.01}
                    value={row.start}
                    onChange={(e) => setRowValue(i, 'start', e.target.value)}
                    className='w-16 border border-black/20 px-1'
                  />
                </td>
                <td className='p-1'>
                  <input
                    type='number'
                    step={0.01}
                    value={row.end}
                    onChange={(e) => setRowValue(i, 'end', e.target.value)}
                    className='w-16 border border-black/20 px-1'
                  />
                </td>
                <td className='p-1'>
                  <button
                    onClick={() => previewRow(i)}
                    disabled={bufferStatus !== 'ready'}
                    className='px-2 py-0.5 border border-black/30 whitespace-nowrap disabled:opacity-30'
                  >
                    {bufferStatus === 'loading' ? '불러오는 중' : bufferStatus === 'error' ? '재생 불가' : '구간 재생'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
