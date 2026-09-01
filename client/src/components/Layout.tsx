/**
 * Layout.tsx
 */

'use client'

import { useEffect, useState } from 'react'

const ENABLE_SCHEDULED_LANDING = true
const LANDING_ENDS_AT = new Date('2026-09-01T17:30:00+09:00').getTime()

interface LayoutProps {
  landing?: boolean
  children: React.ReactNode
}

export function Layout({ children, landing }: LayoutProps) {
  const [hasLandingEnded, setHasLandingEnded] = useState(false)

  useEffect(() => {
    if (!ENABLE_SCHEDULED_LANDING || landing !== undefined) return

    const updateLanding = () => setHasLandingEnded(Date.now() >= LANDING_ENDS_AT)
    const remainingTime = LANDING_ENDS_AT - Date.now()

    updateLanding()

    if (remainingTime <= 0) return

    const timer = window.setTimeout(updateLanding, remainingTime)

    return () => window.clearTimeout(timer)
  }, [landing])

  const showLanding = landing ?? (ENABLE_SCHEDULED_LANDING && !hasLandingEnded)

  if (showLanding)
    return (
      <main className='min-h-dvh flex flex-col items-center justify-center bg-white text-black'>
        <img src='img/icons/soran.png' />
      </main>
    )

  return <main className='flex min-h-dvh flex-col max-w-4xl mx-auto'>{children}</main>
}
