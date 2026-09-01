'use client'

import type { CSSProperties } from 'react'
import classNames from 'classnames'

import { useScrubReveal } from './useScrubReveal'

interface ScrubRevealImageProps {
  src: string
  alt: string
  blurred: boolean
  className?: string
  style?: CSSProperties
  onSufficientlyRevealed?: () => void
}

const BLUR_PX = 8
// filter: blur()는 유한한 영역 안의 주변 픽셀만 섞어서 계산하는 연산이라, 박스 가장자리에 가까운
// 픽셀일수록 섞을 수 있는 주변 데이터가 적어서 안쪽보다 덜 뭉개진 것처럼 보인다(나뭇잎처럼 고주파
// 디테일이 많은 사진일수록 특히 두드러진다). 흐린 이미지 전체를 살짝 확대해서 그리면, 실제로
// 보이는 가장자리는 원본 기준으로 더 안쪽 지점이 되어 그만큼 더 많은 주변 데이터를 섞을 여유가
// 생긴다. transform은 filter/mask가 적용된 결과물을 그대로 확대만 하는 거라(마스크가 자기 박스
// 기준 100%로 맞춰져 있으므로) 마스크와의 정렬은 흐트러지지 않는다.
const BLUR_SCALE = 1.2

// 지우개 모양 SVG 커서. 터치 기기엔 어차피 커서가 없으니 마우스로 문지를 때만 보인다.
// 핫스팟(24 28)을 지우개 밑면 중앙에 맞춰서, 실제로 지워지는 지점과 커서 위치가 일치하게 했다.
const ERASER_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E` +
  `%3Cg transform='rotate(-30 16 16)'%3E` +
  `%3Crect x='8' y='10' width='18' height='13' rx='2.5' fill='white' stroke='%23333333' stroke-width='1.5'/%3E` +
  `%3Crect x='8' y='10' width='18' height='6.5' rx='2.5' fill='%23f472b6' stroke='%23333333' stroke-width='1.5'/%3E` +
  `%3C/g%3E%3C/svg%3E") 24 28, crosshair`

/**
 * 원본 위에 CSS blur가 걸린 동일 이미지를 겹쳐두고, 사용자가 문지른(drag) 자리만큼 그
 * 흐린 레이어에 구멍을 뚫어 아래 선명한 원본을 드러낸다. 실제 지우기 동작은 useScrubReveal 참고.
 */
export function ScrubRevealImage({ src, alt, blurred, className, style, onSufficientlyRevealed }: ScrubRevealImageProps) {
  const { containerRef, canvasRef, bind, maskUrl, hitPadding } = useScrubReveal({ onSufficientlyRevealed })

  return (
    <div
      ref={containerRef}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', ...style }}
      className={classNames('select-none', className)}
    >
      {/* 이미지 레이어만 여기서 클리핑한다 — 문지르기 판정 캔버스는 이 박스 밖(폴라로이드
          여백 쪽)까지 넓게 잡아야 해서 이 overflow-hidden의 영향을 받으면 안 된다. */}
      <div className='absolute inset-0 h-full w-full overflow-hidden'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} className='h-full w-full object-cover object-center' alt={alt} />

        {blurred && (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            src={src}
            aria-hidden
            className='pointer-events-none absolute inset-0 h-full w-full object-cover object-center'
            style={{
              // filter: blur()는 요소 박스 안에서만 계산돼서, 가장자리가 박스 밖(투명)과
              // 섞이며 흐림이 옅어진다(비네트처럼 가장자리만 흐림이 빠짐). scale로 살짝
              // 키워서 그 가장자리 페이드를 부모의 overflow-hidden 밖으로 밀어낸다.
              transform: `scale(${BLUR_SCALE})`,
              filter: `blur(${BLUR_PX}px)`,
              WebkitMaskImage: maskUrl ? `url(${maskUrl})` : undefined,
              maskImage: maskUrl ? `url(${maskUrl})` : undefined,
              WebkitMaskSize: '100% 100%',
              maskSize: '100% 100%',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              // -webkit-mask-mode는 실제로 존재하지 않는 프로퍼티라(-webkit-mask-image는
              // 항상 알파 기준), 표준 mask-image 쪽만 명시하면 된다. 흰색/투명만 쓰므로
              // 사실 이게 없어도 결과는 같지만, 애매한 기본값에 기대지 않으려고 명시한다.
              maskMode: 'alpha',
            }}
          />
        )}
      </div>

      {blurred && (
        <canvas
          {...bind()}
          ref={canvasRef}
          // CSS 박스(=문지르기 판정 영역)를 사진 실제 크기보다 사방으로 hitPadding만큼 넓힌다.
          // canvas는 대체 요소(replaced element)라 width/height를 명시하지 않으면 inset을 줘도
          // 자기 고유(intrinsic) 크기(=canvas.width/height 해상도)를 그대로 써버려서 박스가
          // 커지지 않는다 — width/height를 calc()로 직접 명시해야 실제로 확장된다. 캔버스
          // 해상도 자체(마스크 계산 기준)는 그대로 사진 크기라 블러/마스크 정렬에는 영향이
          // 없다 — useScrubReveal의 erase()가 좌표를 그 비율만큼 다시 스케일링해서 그린다.
          className='absolute touch-none select-none opacity-0'
          style={{
            top: -hitPadding,
            left: -hitPadding,
            width: `calc(100% + ${hitPadding * 2}px)`,
            height: `calc(100% + ${hitPadding * 2}px)`,
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            cursor: ERASER_CURSOR,
          }}
        />
      )}
    </div>
  )
}
