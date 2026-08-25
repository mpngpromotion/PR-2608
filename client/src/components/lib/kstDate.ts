// 문자열 끝에 'Z'나 '+09:00' 같은 타임존 표기가 있는지 확인.
const HAS_TIMEZONE = /Z$|[+-]\d{2}:?\d{2}$/

// 타임존 표기가 없는 문자열(예: '2026-09-17', '2026-09-17 09:00:00', '2026-09-17T09:00:00')은
// 한국 표준시(KST, UTC+9)로 간주해서 파싱한다. 명시적으로 타임존이 붙어있으면 그대로 존중한다.
export function parseAsKst(date: string): Date {
  // 'YYYY-MM-DD HH:MM:SS'처럼 날짜/시간을 스페이스로 구분해 적어도 되도록 T로 바꿔준다.
  const normalized = date.replace(' ', 'T')
  if (HAS_TIMEZONE.test(normalized)) return new Date(normalized)
  const hasTime = normalized.includes('T')
  return new Date(hasTime ? `${normalized}+09:00` : `${normalized}T00:00:00+09:00`)
}

// setTimeout 지연값의 32bit 상한(약 24.8일). 이보다 먼 미래 날짜는 나눠서 재예약한다.
export const MAX_TIMEOUT = 2_147_483_647
