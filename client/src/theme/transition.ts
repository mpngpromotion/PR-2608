// transition-all(opacity 포함)을 쓰면, 이 클래스가 붙은 요소의 opacity를 Framer Motion이
// 따로 JS로 애니메이션할 때(예: MotionDiv의 isDone 페이드) CSS 트랜지션이 그 opacity 값
// 변화에도 매번 끼어들어서 두 애니메이션 시스템이 같은 속성을 두고 충돌해 깜빡였다. 여기서
// 실제로 쓰는 효과(scale/brightness/contrast/saturate)는 transform과 filter뿐이라
// opacity는 트랜지션 대상에서 아예 빼도 된다.
const commonTransition =
  'transition-[transform,filter] ease-in-out duration-200 hover:scale-110  hover:contrast-110 hover:saturate-120 !cursor-pointer active:scale-95 active:contrast-90 active:saturate-90'
export { commonTransition }
