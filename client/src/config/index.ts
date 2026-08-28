export * from './chapters'

export const APP_INFO = {
  name: 'LayerbySORAN', // 웹사이트의 이름
  title: 'LayerbySORAN', // 웹사이트의 기본 제목
  titleTemplate: '%s', // 페이지별로 제목이 필요한 경우 사용 예: 'About - 6800miles'
  description: '소란(SORAN) EP [Layer]', // 웹사이트의 설명
  keywords: [],
  authors: [
    {
      name: 'happyphysicsclub', // 작성자 이름
      url: 'https://happyphysics.club', // 작성자 웹사이트 URL
    },
  ],
  // metadataBase/OG 이미지 절대경로가 이 값 기준으로 만들어진다. 실제 배포 도메인은
  // http://layerbysoran.com → https://layerbysoran.com → https://www.layerbysoran.com
  // 순으로 3단 리다이렉트를 거치는데, 카카오톡 등 링크 미리보기 봇이 이 리다이렉트를 다 안
  // 따라가면 OG 이미지가 빈 화면으로 뜬다. 그래서 리다이렉트 없이 바로 열리는 최종 도메인을 쓴다.
  url: 'https://layerbysoran.com',
  social_links: [], // 관련된 소셜 미디어 링크 추가
  google_site_verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, // 구글 사이트 소유권 확인을 위한 메타 태그 값
  // 정식 오픈 전 프리뷰 배포에서는 false로 두면 검색엔진 노출이 차단됩니다. 오픈 시 배포 환경변수를 "true"로 변경하세요.
  indexable: process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true',
}
