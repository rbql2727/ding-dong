import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { checkImageFile } from '../lib/image'
import { imageLine } from '../lib/richText'
import { BoldIcon, ImageIcon } from './icons'
import { RichText } from './RichText'
import { Spinner } from './ui'

/**
 * 로그 본문 편집기 (간단 버전)
 * - 그냥 쓰면 줄바꿈 그대로
 * - [굵게] 버튼: 고른 글자를 **이렇게** 감쌈
 * - [이미지] 버튼: 사진을 줄여서 올리고 커서 위치에 이미지 줄을 넣음
 * - [미리보기]: 실제로 보일 모습
 */
export function LogBodyEditor({
  value,
  onChange,
  onUploadImage,
}: {
  value: string
  onChange: (next: string) => void
  /** 파일을 올리고 공개 주소를 돌려주는 함수 */
  onUploadImage: (file: File) => Promise<string>
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(0) // 올리는 중인 장수
  const [error, setError] = useState('')

  /** 커서/선택 영역을 바꿔 끼우고, 커서를 원하는 곳에 둠 */
  function replaceSelection(make: (selected: string) => { text: string; cursorStart: number; cursorEnd: number }) {
    const el = textarea.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const { text, cursorStart, cursorEnd } = make(value.slice(start, end))
    onChange(value.slice(0, start) + text + value.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + cursorStart, start + cursorEnd)
    })
  }

  function handleBold() {
    setPreview(false)
    replaceSelection((sel) => {
      if (sel) return { text: `**${sel}**`, cursorStart: 2, cursorEnd: 2 + sel.length }
      return { text: '****', cursorStart: 2, cursorEnd: 2 } // 빈 굵게 → 사이에 커서
    })
  }

  async function handlePickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setPreview(false)
    setError('')

    // 커서 위치 기억 (올리는 동안 커서가 움직여도 그 자리에 넣음)
    const el = textarea.current
    let insertAt = el?.selectionEnd ?? value.length
    let text = value

    for (const file of files) {
      const problem = checkImageFile(file)
      if (problem) {
        setError(problem)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const url = await onUploadImage(file)
        // 이미지는 한 줄을 통째로 차지해야 해서 앞뒤로 줄바꿈을 맞춰 줌
        const before = text.slice(0, insertAt)
        const after = text.slice(insertAt)
        const prefix = before === '' || before.endsWith('\n') ? '' : '\n'
        const suffix = after.startsWith('\n') ? '' : '\n'
        const line = `${prefix}${imageLine(url)}${suffix}`
        text = before + line + after
        insertAt += line.length
        onChange(text)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
      {/* 도구 줄 */}
      <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
        <ToolButton label="굵게" onClick={handleBold}>
          <BoldIcon className="size-5" />
        </ToolButton>
        <ToolButton label="이미지 넣기" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? <Spinner className="size-4" /> : <ImageIcon className="size-5" />}
        </ToolButton>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
        {uploading > 0 && <span className="text-xs text-gray-500">이미지 올리는 중…</span>}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${preview ? 'bg-gray-900 text-white' : 'text-gray-600 active:bg-gray-200'}`}
        >
          {preview ? '편집' : '미리보기'}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[50vh] px-4 py-3">
          {value.trim() ? <RichText text={value} /> : <p className="text-gray-400">아직 쓴 내용이 없어요.</p>}
        </div>
      ) : (
        <textarea
          ref={textarea}
          aria-label="본문"
          // 이미지를 올리는 동안에는 잠깐 잠가서 내용이 엇갈리지 않게
          readOnly={uploading > 0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={50000}
          placeholder={'내용을 자유롭게 써 주세요.\n\n굵게: 글자를 고르고 B 버튼\n이미지: 그림 버튼'}
          className="field-sizing-content block min-h-[50vh] w-full resize-none bg-white px-4 py-3 text-base leading-relaxed outline-none placeholder:text-gray-400"
        />
      )}

      {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      // 버튼을 눌러도 글 입력칸의 선택 영역이 사라지지 않게
      onMouseDown={(e) => e.preventDefault()}
      className="flex size-9 items-center justify-center rounded-lg text-gray-700 active:bg-gray-200 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
