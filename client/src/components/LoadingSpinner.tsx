import classNames from 'classnames'

interface LoadingSpinnerProps {
  className?: string
}

// 이미지/영상 등 미디어가 로드되는 동안 보여주는 간단한 스피너. 화려한 효과 없이 도는 원 하나뿐.
export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div
      role='status'
      aria-label='로딩 중'
      className={classNames(
        'h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70',
        className,
      )}
    />
  )
}
