'use client'

import { useReducer } from 'react'

import { ImagePicker } from './ImagePicker'
import { CreateGather } from './CreateGather'
import { GenerateStep } from './GenerateStep'

type Step = 'picking' | 'gathering' | 'generating' | 'done'

interface State {
  step: Step
  photos: string[]
  videoUrl: string | null
}

type Action =
  | { type: 'SELECT_PHOTOS'; photos: string[] }
  | { type: 'GATHER_COMPLETE' }
  | { type: 'GENERATE_COMPLETE'; videoUrl: string | null }
  | { type: 'RESET' }

const initialState: State = { step: 'picking', photos: [], videoUrl: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_PHOTOS':
      return { ...state, step: 'gathering', photos: action.photos }
    case 'GATHER_COMPLETE':
      return { ...state, step: 'generating' }
    case 'GENERATE_COMPLETE':
      return { ...state, step: 'done', videoUrl: action.videoUrl }
    case 'RESET':
      return initialState
  }
}

export function CreateFlow() {
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <div>
      {state.step === 'picking' && (
        <ImagePicker onSelect={(photos) => dispatch({ type: 'SELECT_PHOTOS', photos })} />
      )}

      {state.step === 'gathering' && (
        <CreateGather
          photos={state.photos}
          onComplete={() => dispatch({ type: 'GATHER_COMPLETE' })}
        />
      )}

      {state.step === 'generating' && (
        <GenerateStep
          photos={state.photos}
          onDone={(videoUrl) => dispatch({ type: 'GENERATE_COMPLETE', videoUrl })}
        />
      )}

      {state.step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-8">
          {state.videoUrl ? (
            <a
              href={state.videoUrl}
              download="layer.mp4"
              className="border border-black/30 px-4 py-2 text-sm "
            >
              다운로드
            </a>
          ) : (
            <p className="text-sm opacity-60">
              다운로드 준비중 — 영상 인코딩은 아직 구현 전이에요 (TODO)
            </p>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET' })}
            className="text-xs opacity-50 hover:opacity-100"
          >
            다시 만들기
          </button>
        </div>
      )}
    </div>
  )
}
