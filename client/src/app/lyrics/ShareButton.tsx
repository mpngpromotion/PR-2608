'use client'

import classNames from 'classnames'
import { GoShare } from 'react-icons/go'
import { commonTransition } from '@/theme/transition'

export const ShareButton = () => {
  const handleShare = async () => {
    const shareData = {
      title: 'Layering Game | SORAN',
      text: "소란의 신곡 '이별직전'을 Layering Game으로 들어보세요!",
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }

      await navigator.clipboard.writeText(shareData.url)
      alert('링크가 복사되었습니다.')
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 오류 안내 없이 종료한다.
      if (error instanceof DOMException && error.name === 'AbortError') return
      alert('공유를 시작하지 못했습니다.')
    }
  }

  return (
    <button
      type='button'
      onClick={handleShare}
      aria-label='공유하기'
      className={classNames('flex h-8 w-8 items-center justify-center', commonTransition)}
    >
      <GoShare className='h-7 w-7' aria-hidden='true' />
    </button>
  )
}
