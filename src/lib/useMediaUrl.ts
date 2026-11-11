import { useEffect, useState } from 'react'
import { getSignedUrl, peekSignedUrl, storagePathOf } from './signedUrl'

/** 저장된 이미지 주소 → 화면에 쓸 수 있는 주소 (우리 Storage 면 서명 주소) */
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
  if (!path) return src
  if (loaded?.path === path) return loaded.url ?? undefined
  return peekSignedUrl(path) ?? undefined
}
