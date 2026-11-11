/**
 * 이미지 줄이기 (브라우저에서 처리 → 업로드 용량·속도 절약)
 * 프로필 사진, 나중에 캐릭터 이미지 썸네일에도 사용합니다.
 */

export type ResizedImage = { blob: Blob; ext: 'webp' | 'jpg' }

export async function resizeImage(
  file: File,
  options: { maxSize: number; square?: boolean; quality?: number },
): Promise<ResizedImage> {
  const { maxSize, square = false, quality = 0.85 } = options
  const bitmap = await createImageBitmap(file)

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
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없어요.')
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
