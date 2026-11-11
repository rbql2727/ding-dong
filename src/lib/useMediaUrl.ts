import { useEffect, useState } from 'react'
import { getSignedUrl, peekSignedUrl, storagePathOf } from './signedUrl'

/**
 * 내 기기 안의 미리보기 주소인지 (사진을 고른 직후 업로드 전 미리보기)
 * blob: 은 이 기기 메모리에만 있는 주소라 외부로 요청이 나가지 않음
 */
function isLocalPreview(src: string) {
  return src.startsWith('blob:')
}

/**
 * 저장된 이미지 주소 → 화면에 쓸 수 있는 주소
 * - 우리 Storage 주소 → 서명 주소로 바꿔서
 * - 내 기기 미리보기(blob:) → 그대로
 * - 그 밖의 주소(다른 사이트 등) → 보여 주지 않음 (undefined)
 *   ※ DB 에 누가 외부 주소를 넣어도, 보는 사람의 브라우저가 그 사이트에 접속하지 않게 (IP 노출·추적 방지)
 */
export function useMediaUrl(src: string | null | undefined): string | undefined {
  const path = storagePathOf(src)
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    getSignedUrl(path).then((url) => {
      if (!cancelled) setLoaded({ path, url })
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!src) return undefined
  if (!path) return isLocalPreview(src) ? src : undefined
  if (loaded?.path === path) return loaded.url ?? undefined
  return peekSignedUrl(path) ?? undefined
}
