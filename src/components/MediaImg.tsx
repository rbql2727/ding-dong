import type { ImgHTMLAttributes } from 'react'
import { useMediaUrl } from '../lib/useMediaUrl'

/**
 * 우리 Storage 이미지 주소를 받아 서명 주소로 바꿔서 보여 주는 <img>.
 * - 우리 Storage 주소가 아니면(blob: 미리보기 등) 그대로 보여 줌
 * - 볼 권한이 없으면 빈 칸(배경색)만 보임
 * 앱에서 업로드한 이미지는 반드시 이걸로 보여 주세요.
 */
export function MediaImg({ src, alt = '', ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null }) {
  const url = useMediaUrl(src)
  if (!url) return <img alt={alt} {...rest} />
  return <img src={url} alt={alt} {...rest} />
}
