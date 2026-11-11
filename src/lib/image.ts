/**
 * 이미지 줄이기 (브라우저에서 처리 → 업로드 용량·속도 절약)
 * 프로필 사진, 위키 표지, 캐릭터 이미지(원본+썸네일), 로그 본문 이미지에 사용합니다.
 */

export type ResizedImage = { blob: Blob; ext: 'webp' | 'jpg' }

/** 고를 수 있는 원본 파일 최대 크기 (줄여서 올리므로 넉넉하게) */
export const MAX_PICK_BYTES = 30 * 1024 * 1024

/** 사용자가 고른 파일이 올릴 수 있는 이미지인지 확인. 문제가 있으면 한국어 메시지, 없으면 null */
export function checkImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return '이미지 파일만 올릴 수 있어요.'
  if (file.size > MAX_PICK_BYTES) return '30MB 이하의 이미지만 올릴 수 있어요.'
  return null
}

export async function resizeImage(
  file: File,
  options: { maxSize: number; square?: boolean; quality?: number },
): Promise<ResizedImage> {
  const { maxSize, square = false, quality = 0.85 } = options

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // HEIC(아이폰 기본 형식) 등 브라우저가 못 읽는 형식
    throw new Error('이 형식의 이미지는 올릴 수 없어요. JPG나 PNG로 바꿔서 올려 주세요.')
  }

  // 정사각형이면 가운데를 잘라냄
  let sx = 0
  let sy = 0
  let sw = bitmap.width
  let sh = bitmap.height
  if (square) {
    const side = Math.min(sw, sh)
    sx = (sw - side) / 2
    sy = (sh - side) / 2
    sw = sh = side
  }

  const scale = Math.min(1, maxSize / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없어요.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // webp 로 저장 (지원 안 하는 브라우저는 jpg)
  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' }
  const jpg = await toBlob(canvas, 'image/jpeg', quality)
  if (!jpg) throw new Error('이미지를 처리할 수 없어요.')
  return { blob: jpg, ext: 'jpg' }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}
