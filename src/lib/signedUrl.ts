import { mediaPathFromUrl } from './storage'
import { MEDIA_BUCKET, supabase } from './supabase'

/**
 * 이미지 서명 주소(signed URL)
 *
 * media 버킷은 비공개라서 저장된 주소로는 이미지가 열리지 않습니다.
 * 화면에 보여 줄 때마다 Supabase 에 "이 파일 볼 수 있나요?" 를 물어
 * 짧게 유효한 서명 주소를 받아서 씁니다. (권한은 DB 의 Storage 정책이 판단)
 *
 * - 같은 순간에 요청된 이미지는 한 번에 모아서 요청 (목록 화면이 빨라짐)
 * - 받은 주소는 만료 전까지 메모리에 보관해서 재사용 (브라우저 캐시도 잘 맞음)
 * - 로그아웃하면 비움
 */

const EXPIRES_IN = 60 * 30 // 30분
const REUSE_MARGIN_MS = 5 * 60 * 1000 // 만료 5분 전부터는 새로 받음

type Entry = { url: string | null; expiresAt: number }
const cache = new Map<string, Entry>()
let waiting = new Map<string, ((url: string | null) => void)[]>()
let timer: ReturnType<typeof setTimeout> | null = null

/** 지금 바로 쓸 수 있는 서명 주소 (없으면 undefined) */
export function peekSignedUrl(path: string): string | null | undefined {
  const hit = cache.get(path)
  if (!hit || hit.expiresAt - REUSE_MARGIN_MS < Date.now()) return undefined
  return hit.url
}

/** 서명 주소 받기. 볼 권한이 없거나 파일이 없으면 null */
export function getSignedUrl(path: string): Promise<string | null> {
  const ready = peekSignedUrl(path)
  if (ready !== undefined) return Promise.resolve(ready)
  return new Promise((resolve) => {
    const list = waiting.get(path)
    if (list) list.push(resolve)
    else waiting.set(path, [resolve])
    if (!timer) timer = setTimeout(flush, 10)
  })
}

async function flush() {
  timer = null
  const batch = waiting
  waiting = new Map()
  const paths = [...batch.keys()]

  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    const results = new Map<string, string | null>()
    try {
      const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(chunk, EXPIRES_IN)
      if (error) console.warn('[이미지 주소 받기 실패]', error)
      for (const item of data ?? []) {
        if (item.path) results.set(item.path, item.error ? null : item.signedUrl)
      }
    } catch (err) {
      console.warn('[이미지 주소 받기 실패]', err)
    }
    const expiresAt = Date.now() + EXPIRES_IN * 1000
    for (const path of chunk) {
      const url = results.get(path) ?? null
      // 실패(권한 없음)는 잠깐만 기억 → 승인되면 곧 다시 시도
      cache.set(path, { url, expiresAt: url ? expiresAt : Date.now() + REUSE_MARGIN_MS + 30_000 })
      for (const resolve of batch.get(path) ?? []) resolve(url)
    }
  }
}

/** 로그인 사용자가 바뀌면 비우기 */
export function clearSignedUrlCache() {
  cache.clear()
}

/** 저장된 이미지 주소가 우리 Storage 것이면 버킷 안 경로, 아니면 null (blob: 미리보기 등) */
export function storagePathOf(src: string | null | undefined): string | null {
  return mediaPathFromUrl(src)
}
