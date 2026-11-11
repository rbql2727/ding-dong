import { MEDIA_BUCKET, supabase } from './supabase'

/**
 * media 버킷에 파일 올리기.
 * 경로는 반드시 "{내 user id}/..." 로 시작해야 합니다 (DB 정책이 다른 경로는 막음).
 * @returns 공개 URL
 */
export async function uploadMedia(path: string, file: Blob): Promise<string> {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000', // 파일명이 매번 달라서 오래 캐시해도 안전
    upsert: false,
  })
  if (error) throw new Error('이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.')
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

/** 공개 URL 에서 버킷 안 경로를 뽑아냄 (우리 버킷 파일이 아니면 null) */
export function mediaPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

/** 파일 지우기 (실패해도 앱 동작엔 지장 없으므로 조용히 무시) */
export async function removeMediaByUrl(url: string | null | undefined) {
  const path = mediaPathFromUrl(url)
  if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path])
}
