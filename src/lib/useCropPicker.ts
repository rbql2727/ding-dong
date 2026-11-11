import { useCallback, useEffect, useRef, useState } from 'react'
import { checkImageFile } from './image'

/**
 * 사진 고르기 → 자르기 창 열기 상태 관리
 *   const crop = useCropPicker(setError)
 *   crop.pick(file)          // 파일을 고르면 호출 → 자르기 창 열림
 *   crop.target              // { file, src } | null  (열려 있을 때)
 *   crop.close()             // 닫기 (미리보기 주소 정리)
 */
export function useCropPicker(onError: (message: string) => void) {
  const [target, setTarget] = useState<{ file: File; src: string } | null>(null)
  const current = useRef<string | null>(null)

  const close = useCallback(() => {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = null
    setTarget(null)
  }, [])

  const pick = useCallback(
    (file: File) => {
      const problem = checkImageFile(file)
      if (problem) return onError(problem)
      if (current.current) URL.revokeObjectURL(current.current)
      const src = URL.createObjectURL(file)
      current.current = src
      setTarget({ file, src })
    },
    [onError],
  )

  // 화면을 떠날 때 정리
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current)
    },
    [],
  )

  return { target, pick, close }
}
