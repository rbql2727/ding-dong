import { EditorContent, useEditor } from '@tiptap/react'
import { useMemo } from 'react'
import { safeDocFromBody } from '../../lib/richText'
import { logExtensions } from './extensions'

/** 로그 본문 보기 (읽기 전용). 반드시 정리된(sanitize) 문서만 넣음 */
export function LogViewer({ body }: { body: string }) {
  const doc = useMemo(() => safeDocFromBody(body), [body])
  const editor = useEditor(
    {
      editable: false,
      extensions: logExtensions({ editable: false }),
      content: doc,
    },
    [doc],
  )
  return <EditorContent editor={editor} className="log-content" />
}
