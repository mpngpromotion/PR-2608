export * from "./chapters";

export const APP_INFO = {
  name: "SORAN - Layer [EP]", // 웹사이트의 이름
  title: "SORAN - Layer [EP]", // 웹사이트의 기본 제목
  titleTemplate: "%s", // 페이지별로 제목이 필요한 경우 사용 예: 'About - 6800miles'
  description: "소란 LAYER [EP] 발매 프로모션 사이트", // 웹사이트의 설명
  keywords: [],
  authors: [
    {
      name: 'happyphysicsclub', // 작성자 이름
      url: "https://happyphysics.club", // 작성자 웹사이트 URL
    },
  ],
  url: "http://localhost:3000", // 웹사이트의 실제 URL로 변경
  social_links: [], // 관련된 소셜 미디어 링크 추가
  google_site_verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, // 구글 사이트 소유권 확인을 위한 메타 태그 값
  // 정식 오픈 전 프리뷰 배포에서는 false로 두면 검색엔진 노출이 차단됩니다. 오픈 시 배포 환경변수를 "true"로 변경하세요.
  indexable: process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true",
};
