import type { Visibility } from './types'

/** 공개 범위 선택지 (화면 문구) */
export const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: 'private', label: '비공개', description: '나만 볼 수 있어요.' },
  { value: 'link', label: '링크 공개', description: '공유 링크를 받은 사람만, 로그인하면 볼 수 있어요.' },
  {
    value: 'approved',
    label: '승인한 사람만',
    description: '탐색에 제목과 표지만 보이고, 열람 요청을 내가 승인한 사람만 내용을 볼 수 있어요.',
  },
  { value: 'public', label: '전체 공개', description: '로그인한 모든 사용자가 볼 수 있어요.' },
]

export function visibilityLabel(v: Visibility) {
  return VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v
}
