import type { CSSProperties } from 'react'

/** 위키 테마 색 고르기용 기본 색 */
export const THEME_COLORS = [
  '#6366f1', // 남보라
  '#8b5cf6', // 보라
  '#ec4899', // 분홍
  '#ef4444', // 빨강
  '#f97316', // 주황
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#14b8a6', // 청록
  '#0ea5e9', // 하늘
  '#64748b', // 회색
  '#1f2937', // 먹색
]

export const DEFAULT_THEME_COLOR = THEME_COLORS[0]

/** 위키 화면에서 테마 색을 CSS 변수(--wiki)로 넘겨 줌 → bg-(--wiki), text-(--wiki) 로 사용 */
export function themeStyle(color: string | undefined): CSSProperties {
  return { '--wiki': color || DEFAULT_THEME_COLOR } as CSSProperties
}
