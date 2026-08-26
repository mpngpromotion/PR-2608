'use client'

import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import { commonTransition } from '@/theme/transition'

export const Header = () => {
  const router = useRouter()
  return (
    <div className='w-full h-fit flex flex-col justify-center items-center px-10'>
      <img
        src='/img/icons/soran.png'
        className={classNames('w-20', commonTransition)}
        alt='소란'
        onClick={() => router.push('/')}
      />
    </div>
  )
}
