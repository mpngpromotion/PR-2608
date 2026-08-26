'use client'

import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import { commonTransition } from '@/theme/transition'

export const Header = ({ className }: { className?: string }) => {
  const router = useRouter()
  return (
    <div className={classNames('w-full h-fit flex flex-col justify-center items-center px-10', className)}>
      <img
        src='/img/icons/soran.png'
        className={classNames('w-20', commonTransition)}
        alt='소란'
        onClick={() => router.push('/')}
      />
    </div>
  )
}
