import { useEffect } from 'react'
import { useBackHandler } from '../lib/backStack'
import { CloseIcon, LeftIcon, RightIcon } from './icons'
import { MediaImg } from './MediaImg'

/** 이미지 크게 보기 (원본) */
export function ImageViewer({
  urls,
  index,
  onIndexChange,
  onClose,
}: {
  urls: string[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  useBackHandler(true, onClose) // 안드로이드 뒤로가기 → 닫기
  const hasPrev = index > 0
  const hasNext = index < urls.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1)
      if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, hasPrev, hasNext, onIndexChange, onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="이미지 보기">
      <div className="flex items-center justify-between px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-white">
        <span className="px-3 text-sm text-white/70">
          {index + 1} / {urls.length}
        </span>
        <button type="button" onClick={onClose} aria-label="닫기" className="flex size-11 items-center justify-center rounded-full active:bg-white/10">
          <CloseIcon />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <MediaImg key={urls[index]} src={urls[index]} alt="" decoding="async" className="max-h-full max-w-full object-contain" />
        {hasPrev && (
          <button
            type="button"
            aria-label="이전 이미지"
            onClick={() => onIndexChange(index - 1)}
            className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <LeftIcon />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            aria-label="다음 이미지"
            onClick={() => onIndexChange(index + 1)}
            className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <RightIcon />
          </button>
        )}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  )
}
