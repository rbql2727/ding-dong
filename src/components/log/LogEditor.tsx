import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useImperativeHandle, useState, type Ref } from 'react'
import { checkImageFile } from '../../lib/image'
import { isDocEmpty, sanitizeDoc, type DocNode } from '../../lib/logDocCore'
import { isAllowedLogImage, safeDocFromBody } from '../../lib/richText'
import { logExtensions } from './extensions'
import { LogToolbar } from './LogToolbar'

export type LogEditorHandle = {
  /** 저장용 본문 (정리된 문서의 JSON 문자열, 비었으면 '') */
  getBody: () => string
}

/** 로그 본문 편집기 (툴바 + 보이는 그대로 편집) */
export function LogEditor({
  initialBody,
  onUploadImage,
  ref,
}: {
  initialBody: string
  /** 파일을 올리고 주소를 돌려줌 */
  onUploadImage: (file: File) => Promise<string>
  ref?: Ref<LogEditorHandle>
}) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')

  const editor = useEditor({
    extensions: logExtensions({ editable: true }),
    content: safeDocFromBody(initialBody),
    editorProps: {
      attributes: { class: 'log-content min-h-[50vh] px-4 py-4 outline-none', 'aria-label': '본문' },
      // 사진을 붙여넣거나 끌어다 놓으면 바로 올림
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (!files.length) return false
        void insertImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (!files.length) return false
        void insertImages(files)
        return true
      },
    },
  })

  useImperativeHandle(ref, () => ({
    getBody: () => {
      if (!editor) return ''
      const doc = sanitizeDoc(editor.getJSON(), isAllowedLogImage) as DocNode
      return isDocEmpty(doc) ? '' : JSON.stringify(doc)
    },
  }))

  async function insertImages(files: File[], target: Editor | null = editor) {
    if (!target) return
    setError('')
    for (const file of files) {
      const problem = checkImageFile(file)
      if (problem) {
        setError(problem)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const src = await onUploadImage(file)
        // 고른 글자를 지우지 않도록 선택 끝에 넣음
        target.chain().focus().setTextSelection(target.state.selection.to).setImage({ src, alt: '' }).run()
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  if (!editor) return null

  return (
    <div className="px-window">
      <LogToolbar editor={editor} uploading={uploading > 0} onPickImages={(files) => insertImages(files)} />
      {uploading > 0 && <p className="bg-ink px-3 py-1 text-xs text-paper">이미지 올리는 중… (자동으로 크기를 줄여요)</p>}
      <EditorContent editor={editor} />
      {error && <p className="border-t-2 border-red-600 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
