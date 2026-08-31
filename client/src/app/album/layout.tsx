import type { Metadata } from 'next'

// page.tsx가 'use client'라 metadata를 직접 export할 수 없어서, 같은 라우트 세그먼트의
// 서버 컴포넌트 layout에 title만 따로 붙여준다.
export const metadata: Metadata = {
  title: '앨범',
}

export default function AlbumLayout({ children }: { children: React.ReactNode }) {
  return children
}
