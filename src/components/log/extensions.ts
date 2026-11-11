import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { Color, FontFamily, TextStyle } from '@tiptap/extension-text-style'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { LogImageView } from './LogImageView'

/**
 * 로그 편집기·보기 화면이 함께 쓰는 기능 목록.
 * 여기 있는 것 = 툴바로 쓸 수 있는 것 = logDocCore.ts 허용 목록과 맞아야 함.
 */
export function logExtensions({ editable }: { editable: boolean }) {
  return [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      link: {
        openOnClick: !editable,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
    }),
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({ types: ['paragraph'] }),
    // 이미지는 서명 주소로 보여 주는 전용 화면 조각 사용
    Image.extend({
      addNodeView() {
        return ReactNodeViewRenderer(LogImageView)
      },
    }).configure({ inline: false, allowBase64: false }),
    TableKit.configure({ table: { resizable: false } }),
  ]
}
