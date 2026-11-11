import { docImageUrls, docPreview, parseBody, sanitizeDoc, type DocNode } from './logDocCore'
import { mediaPathFromUrl } from './storage'

/**
 * 로그 본문 도우미 (앱 쪽 연결)
 * 실제 규칙은 logDocCore.ts — 여기서는 "우리 Storage 이미지만 허용" 규칙을 연결합니다.
 */

export const isAllowedLogImage = (src: string) => mediaPathFromUrl(src) !== null

/** 저장된 본문 → 보여 줘도 안전한 문서 */
export function safeDocFromBody(body: string): DocNode {
  return sanitizeDoc(parseBody(body), isAllowedLogImage)
}

/** 본문 안의 이미지 주소 목록 (삭제·정리용) */
export function extractImageUrls(body: string): string[] {
  return docImageUrls(body, isAllowedLogImage)
}

/** 목록에 보여 줄 미리보기 글 */
export function toPreview(body: string, max = 100): string {
  return docPreview(body, max)
}
