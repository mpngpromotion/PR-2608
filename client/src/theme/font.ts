import localFont from 'next/font/local'

export const uhbee = localFont({
  src: '../../public/fonts/UhBeeJJIBBABBA.woff',
  display: 'swap',
  // regular , bold
  weight: '400 700',
  variable: '--font-uhbee',
})

// MonoplexKRNerd (메인용)
export const monoplexKRNerd = localFont({
  src: [
    {
      path: '../../public/fonts/MonoplexKRNerd-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/MonoplexKRNerd-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/MonoplexKRNerd-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-monoplexKRNerd',
  display: 'swap',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0100-024F' }], // 라틴 유니코드 범위
})
