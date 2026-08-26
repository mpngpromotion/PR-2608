'use client'

import { useRef, useState } from 'react'

import { IntroGather } from './IntroGather'
import { NameInput } from './NameInput'
import { ImagePicker } from './ImagePicker'
import { GenerateStep, GeneratedVideoResult } from './GenerateStep'

// 기획안 "무드필름 제작 기능 인트로" 흐름 그대로: 인트로(터치→모으기) → 이름 입력 → 사진 선택 → 생성 → 완료
type Step = 'intro' | 'naming' | 'picking' | 'generating' | 'done'

export function CreateFlow() {
  const [step, setStep] = useState<Step>('intro')
  const [name, setName] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [video, setVideo] = useState<GeneratedVideoResult | null>(null)
  // navigator.share는 서버(SSR)엔 없고 지원 브라우저도 제한적이라, lazy 초기값으로 클라이언트에서만 확인한다.
  const [canShare] = useState(() => typeof navigator !== 'undefined' && !!navigator.share)
  const [isSharing, setIsSharing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const reset = () => {
    setStep('intro')
    setName('')
    setPhotos([])
    setVideo(null)
  }

  const handleShare = async () => {
    if (!video || isSharing) return
    const file = new File([video.blob], `${name || 'layer'}.${video.extension}`, { type: video.blob.type })

    if (!navigator.canShare?.({ files: [file] })) {
      alert('이 브라우저에서는 파일 공유가 지원되지 않아요. 다운로드 후 공유해주세요.')
      return
    }

    // iOS Safari는 <video>가 같은 blob 리소스를 물고 있는 상태로 공유하면
    // 공유 시트가 안 닫히고 화면이 눌린 채로 멈추는 경우가 있어, 공유 전에 아예 리소스를 반납한다.
    const el = videoRef.current
    el?.pause()
    el?.removeAttribute('src')
    el?.load()

    setIsSharing(true)
    try {
      await navigator.share({ files: [file], title: name || '무드필름' })
    } catch (error) {
      // 사용자가 공유 시트를 취소한 경우(AbortError)는 정상 흐름이라 조용히 넘어간다.
      if (error instanceof Error && error.name !== 'AbortError') {
        alert(`공유에 실패했어요.\n${error.name}: ${error.message}`)
      }
    } finally {
      // 반납했던 비디오를 다시 붙인다.
      if (el) el.src = video.url
      setIsSharing(false)
    }
  }

  return (
    <div className='w-full h-dvh overflow-y-auto flex flex-col justify-start items-center gap-8 py-10 text-center'>
      {step === 'intro' && <IntroGather onComplete={() => setStep('naming')} />}

      {step === 'naming' && <NameInput name={name} onChange={setName} onNext={() => setStep('picking')} />}

      {step === 'picking' && (
        <ImagePicker
          onSelect={(selected) => {
            setPhotos(selected)
            setStep('generating')
          }}
        />
      )}

      {step === 'generating' && (
        <GenerateStep
          photos={photos}
          onDone={(result) => {
            setVideo(result)
            setStep('done')
          }}
        />
      )}

      {step === 'done' && (
        <div className='flex flex-col items-center gap-4 py-8'>
          {video ? (
            <>
              {/* playsInline 없으면 iOS Safari가 재생 시 네이티브 전체화면으로 전환하려다 멈추는 경우가 있다 */}
              <video
                ref={videoRef}
                src={video.url}
                controls
                playsInline
                className='mx-auto aspect-9/16 w-full max-w-xs bg-black'
              />
              <div className='flex gap-2'>
                <a
                  href={video.url}
                  download={`${name || 'layer'}.${video.extension}`}
                  className='border border-black/30 px-4 py-2 text-sm'
                >
                  다운로드
                </a>
                {canShare && (
                  <button
                    type='button'
                    onClick={handleShare}
                    disabled={isSharing}
                    className='border border-black/30 px-4 py-2 text-sm disabled:opacity-40'
                  >
                    {isSharing ? '공유 중...' : '공유하기'}
                  </button>
                )}
              </div>
              {/* iOS Safari의 알려진 버그: 공유 후 이전 화면이 반투명하게 남아 터치를 가로챌 때가 있다.
                  JS로는 고칠 수 없는 WebKit 버그라(https://github.com/expo/expo/issues/43774),
                  화면을 한 번 탭하면 없어진다는 걸 안내한다. */}
              {canShare && <p className='text-xs opacity-70'>공유 후 화면이 안 움직이면 화면을 한 번 탭해주세요.</p>}
            </>
          ) : (
            <p className='text-sm opacity-60'>영상을 만들지 못했어요. 사진 형식을 확인해주세요.</p>
          )}
          <button type='button' onClick={reset} className='text-xs opacity-50 hover:opacity-100'>
            다시 만들기
          </button>
        </div>
      )}
    </div>
  )
}
