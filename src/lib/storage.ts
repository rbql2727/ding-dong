import { resizeImage } from './image'
import { MEDIA_BUCKET, SUPABASE_URL, supabase } from './supabase'

/**
 * 이미지 저장소(media 버킷) 도우미
 *
 * 파일 경로 규칙 — 첫 폴더는 반드시 "내 user id" (DB 정책이 다른 경로는 막음)
 *   프로필 사진   {uid}/avatar/{uuid}.webp
 *   위키 표지     {uid}/wikis/{wikiId}/cover-{uuid}.webp
 *   캐릭터 이미지 {uid}/wikis/{wikiId}/characters/{charId}/{uuid}.webp  (+ {uuid}_thumb.webp)
 *   로그 본문     {uid}/wikis/{wikiId}/characters/{charId}/logs/{uuid}.webp
 */

/** 이미지 크기 기준 (긴 변 기준 px) */
export const IMAGE_SIZE = {
  original: 1600, // 상세 화면용 원본
  thumb: 400, // 목록용 썸네일
  cover: 1200, // 위키 표지 (가로)
  avatar: 256, // 프로필 사진 (정사각형)
}

/** 위키 표지 비율 (가로 8 : 세로 3). 화면의 표지 칸도 모두 이 비율 → 자른 그대로 보임 */
export const COVER_ASPECT = 8 / 3

export const mediaPaths = {
  avatar: (uid: string) => `${uid}/avatar/${crypto.randomUUID()}`,
  wikiCover: (uid: string, wikiId: string) => `${uid}/wikis/${wikiId}/cover-${crypto.randomUUID()}`,
  characterImage: (uid: string, wikiId: string, charId: string) =>
    `${uid}/wikis/${wikiId}/characters/${charId}/${crypto.randomUUID()}`,
  logImage: (uid: string, wikiId: string, charId: string) =>
    `${uid}/wikis/${wikiId}/characters/${charId}/logs/${crypto.randomUUID()}`,
}

/**
 * media 버킷에 파일 올리기.
 * @returns 공개 URL 형식의 주소. DB 에는 이 주소를 "파일 이름표"로 저장합니다.
 *   버킷이 비공개라 이 주소로 직접 열리지는 않고, 화면에서는 MediaImg 가 서명 주소로 바꿔 보여 줍니다.
 */
export async function uploadMedia(path: string, file: Blob): Promise<string> {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000', // 파일명이 매번 달라서 오래 캐시해도 안전
    upsert: false,
  })
  if (error) {
    console.error('[업로드 실패]', error)
    throw new Error('이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

/** 이미지를 줄여서 올리기. basePath 에 확장자(.webp/.jpg)가 붙습니다. */
export async function uploadResizedImage(
  file: File,
  basePath: string,
  maxSize: number,
  options: { square?: boolean; quality?: number } = {},
): Promise<string> {
  const { blob, ext } = await resizeImage(file, { maxSize, ...options })
  return uploadMedia(`${basePath}.${ext}`, blob)
}

/** 이미 만들어 둔 이미지(잘라 낸 사진 등) 올리기. basePath 에 확장자가 붙습니다. */
export async function uploadBlob(blob: Blob, basePath: string): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
  return uploadMedia(`${basePath}.${ext}`, blob)
}

/** 원본(1600)과 썸네일(400) 두 벌 올리기 */
export async function uploadImageWithThumb(file: File, basePath: string) {
  const imageUrl = await uploadResizedImage(file, basePath, IMAGE_SIZE.original, { quality: 0.85 })
  try {
    const thumbUrl = await uploadResizedImage(file, `${basePath}_thumb`, IMAGE_SIZE.thumb, { quality: 0.8 })
    return { imageUrl, thumbUrl }
  } catch (err) {
    await removeMediaUrls([imageUrl])
    throw err
  }
}

/** 공개 URL 에서 버킷 안 경로를 뽑아냄 (우리 버킷 파일이 아니면 null) */
export function mediaPathFromUrl(url: string | null | undefined): string | null {
  if (!url || !SUPABASE_URL || !url.startsWith(SUPABASE_URL + '/')) return null
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  return path.includes('..') ? null : path
}

/** 여러 파일 지우기 (실패해도 앱 동작엔 지장 없으므로 조용히 넘어감) */
export async function removeMediaUrls(urls: (string | null | undefined)[]) {
  const paths = [...new Set(urls.map(mediaPathFromUrl).filter((p): p is string => !!p))]
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 100))
    if (error) console.warn('[파일 정리 실패]', error)
  }
}

/** 파일 하나 지우기 */
export async function removeMediaByUrl(url: string | null | undefined) {
  await removeMediaUrls([url])
}
