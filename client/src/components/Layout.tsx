/**
 * Layout.tsx
 */

interface LayoutProps {
  landing?: boolean
  children: React.ReactNode
}

export function Layout({ children, landing }: LayoutProps) {
  if (landing)
    return (
      <main className='min-h-dvh flex flex-col items-center justify-center bg-white text-black'>
        <img src='img/icons/soran.png' />
      </main>
    )

  return <main className='flex min-h-dvh flex-col'>{children}</main>
}
