import { EditorContent, useEditor } from '@tiptap/react'
import { useMemo } from 'react'
import { isChatBody, parseChatBody } from '../../lib/chatLog'
import { safeDocFromBody } from '../../lib/richText'
import { ChatLogView } from './ChatLogView'
import { logExtensions } from './extensions'

/** 로그 본문 보기 — 채팅 로그면 말풍선, 아니면 글 */
export function LogViewer({ body, charName }: { body: string; charName: string }) {
  if (isChatBody(body)) return <ChatLogView parts={parseChatBody(body)} charName={charName} />
  return <DocViewer body={body} />
}

/** 글 보기 (읽기 전용). 반드시 정리된(sanitize) 문서만 넣음 */
function DocViewer({ body }: { body: string }) {
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
