'use client'

import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import { IoIosArrowBack } from 'react-icons/io'
import { commonTransition } from '@/theme/transition'

export const Header = ({ className }: { className?: string }) => {
  const router = useRouter()

  const handleBack = () => {
    router.back()
  }

  return (
    <div className={classNames('w-full relative h-fit flex flex-col justify-center items-center px-10', className)}>
      <button
        onClick={handleBack}
        className={classNames('absolute left-0 top-1/2 p-4 -translate-y-1/2 text-2xl text-primary', commonTransition)}
      >
        <IoIosArrowBack />
      </button>
      {/*  eslint-disable-next-line @next/next/no-img-element */}
      <img src='/img/icons/soran.png' className={classNames('w-20')} alt='소란' />
    </div>
  )
}
