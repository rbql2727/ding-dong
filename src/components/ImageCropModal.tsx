import { useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useBackHandler } from '../lib/backStack'
import { cropToBlob } from '../lib/image'
import { Button, ErrorText } from './ui'

/**
 * 사진 자르기 창 — 끌어서 위치 맞추기, 두 손가락·휠·슬라이더로 확대/축소
 * 다 맞추면 정해진 크기의 이미지(Blob)를 돌려줌.
 */
export function ImageCropModal({
  file,
  src,
  title,
  aspect,
  outputWidth,
  round = false,
  onCancel,
  onDone,
}: {
  file: File
  /** 미리보기 주소 (URL.createObjectURL(file)) — 여는 쪽에서 만들고 닫을 때 정리 */
  src: string
  title: string
  /** 가로 ÷ 세로 (정사각형 = 1) */
  aspect: number
  /** 결과 이미지 가로 크기(px) */
  outputWidth: number
  /** 둥근 안내선으로 보여 줄지 (결과는 언제나 네모) */
  round?: boolean
  onCancel: () => void
  onDone: (blob: Blob) => Promise<void> | void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 안드로이드 뒤로가기 → 닫기
  useBackHandler(true, () => {
    if (!busy) onCancel()
  })

  // 키보드 Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  async function apply() {
    if (!area) return
    setBusy(true)
    setError('')
    try {
      const { blob } = await cropToBlob(file, area, outputWidth, Math.round(outputWidth / aspect))
      await onDone(blob)
    } catch (err) {
      setError((err as Error).message || '사진을 처리하지 못했어요.')
      setBusy(false)
    }
  }

  const changeZoom = (z: number) => setZoom(Math.min(4, Math.max(1, Math.round(z * 100) / 100)))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/70 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="px-window flex max-h-dvh w-full max-w-lg flex-col sm:mx-4">
        <div className="px-titlebar flex h-11 shrink-0 items-center justify-between gap-2 pr-2 pl-3">
          <h2 className="truncate font-title text-base">{title}</h2>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="닫기" className="px-winbtn size-7 min-w-7">
            ×
          </button>
        </div>

        {/* 자르기 영역 */}
        <div className="relative h-[min(60vh,420px)] shrink-0 border-b-3 border-ink bg-night">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={aspect}
            cropShape={round ? 'round' : 'rect'}
            showGrid
            zoomWithScroll
            onCropChange={setCrop}
            onZoomChange={changeZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            style={{ cropAreaStyle: { border: '3px solid #e66b2c', color: 'rgba(23, 28, 54, 0.65)' } }}
          />
        </div>

        <div className="space-y-4 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <p className="text-center text-xs text-gray-500">사진을 끌어서 위치를 맞추고, 두 손가락이나 아래 막대로 확대·축소하세요.</p>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="축소" onClick={() => changeZoom(zoom - 0.2)} className="px-winbtn size-9 min-w-9 text-lg">
              −
            </button>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              aria-label="확대·축소"
              className="h-2 flex-1 accent-accent"
            />
            <button type="button" aria-label="확대" onClick={() => changeZoom(zoom + 0.2)} className="px-winbtn size-9 min-w-9 text-lg">
              +
            </button>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              취소
            </Button>
            <Button type="button" onClick={apply} loading={busy} disabled={!area}>
              적용
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
