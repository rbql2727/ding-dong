import { mediaPathFromUrl } from './storage'

/**
 * 로그 본문 형식 (아주 간단한 마크다운)
 *
 *   줄바꿈        그대로 줄바꿈
 *   **굵게**      굵은 글씨
 *   ![설명](주소)  그 줄 전체가 이미지 (우리 Storage 이미지 주소만 표시)
 *
 * HTML 을 그대로 넣지 않고 React 요소로 그리기 때문에 스크립트 삽입 같은 위험이 없습니다.
 */

const IMAGE_LINE = /^!\[([^\]\n]*)\]\((\S+)\)$/
export const BOLD = /\*\*(.+?)\*\*/g

export function parseImageLine(line: string): { alt: string; url: string } | null {
  const m = line.trim().match(IMAGE_LINE)
  if (!m || !mediaPathFromUrl(m[2])) return null
  return { alt: m[1], url: m[2] }
}

/** 이미지 한 줄 문자열 만들기 (편집기에서 삽입할 때) */
export function imageLine(url: string, alt = '이미지') {
  return `![${alt}](${url})`
}

/** 본문 안의 이미지 주소 목록 (삭제·정리용) */
export function extractImageUrls(text: string): string[] {
  return text
    .split('\n')
    .map(parseImageLine)
    .filter((x): x is { alt: string; url: string } => !!x)
    .map((x) => x.url)
}

/** 목록에 보여 줄 미리보기 글 (이미지·기호 빼고 앞부분만) */
export function toPreview(text: string, max = 100): string {
  const plain = text
    .split('\n')
    .filter((line) => !line.trim().match(IMAGE_LINE))
    .join(' ')
    .replace(BOLD, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max) + '…' : plain
}
