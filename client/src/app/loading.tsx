/**
 * loading.tsx
 */

import { LoadingSpinner } from '@/components'

export default function Loading() {
  return (
    <div className='flex h-dvh w-screen items-center justify-center '>
      <LoadingSpinner />
    </div>
  )
}
