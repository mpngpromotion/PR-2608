'use client'

import { useState } from 'react'

interface CarouselNavButtonProps {
  side: 'left' | 'right'
  label: string
  src: string
  disabled: boolean
  onClick: () => void
}

// iOS Safari는 터치 리스너가 없는 요소엔 :active를 안 걸어주므로, hover/active 대신
// 포인터 이벤트로 눌림 상태를 직접 관리해 터치/마우스 모두에서 눌리는 느낌을 준다.
export function CarouselNavButton({ side, label, src, disabled, onClick }: CarouselNavButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const release = () => setIsPressed(false)

  return (
    <button
      type='button'
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      style={{
        zIndex: 10,
        opacity: disabled ? 0.4 : 0.8,
        transform: `translateY(-50%) scale(${isPressed ? 0.85 : 1})`,
      }}
      className={`absolute top-1/2 z-10 bg-transparent px-4 py-8 transition-[transform,opacity] duration-150 disabled:pointer-events-none cursor-pointer ${
        side === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt='' className='h-6' />
    </button>
  )
}
