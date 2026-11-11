import { useEditorState, type Editor } from '@tiptap/react'
import { useRef, useState, type ReactNode } from 'react'
import { PromptModal } from '../Modal'
import { Spinner } from '../ui'
import { DEFAULT_LOG_FONT, LOG_FONTS, TEXT_COLORS } from '../../lib/logDocCore'

/**
 * 로그 편집 툴바
 * 글꼴 | 굵게 기울임 밑줄 취소선 | 형광펜 글자색 | 링크 이미지 | 정렬 표 인용 구분선 | 목록 번호목록 내어쓰기 들여쓰기
 */
export function LogToolbar({
  editor,
  onPickImages,
  uploading,
}: {
  editor: Editor
  onPickImages: (files: File[]) => void
  uploading: boolean
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      font: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? DEFAULT_LOG_FONT.value,
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      align: ((['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left') as
        | 'left'
        | 'center'
        | 'right'
        | 'justify',
      table: e.isActive('table'),
      quote: e.isActive('blockquote'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      inList: e.isActive('listItem'),
    }),
  })
  const [popup, setPopup] = useState<'color' | 'align' | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  if (!state) return null
  const chain = () => editor.chain().focus()
  // 표·구분선은 고른 글자를 지우지 않도록, 선택 끝 위치로 커서를 옮긴 뒤 넣음
  const chainAtEnd = () => editor.chain().focus().setTextSelection(editor.state.selection.to)

  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-[6] border-b-3 border-ink bg-gray-50">
      <div className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none]">
        <select
          aria-label="글꼴"
          value={LOG_FONTS.some((f) => f.value === state.font) ? state.font : DEFAULT_LOG_FONT.value}
          onChange={(e) => {
            const v = e.target.value
            if (v === DEFAULT_LOG_FONT.value) chain().unsetFontFamily().run()
            else chain().setFontFamily(v).run()
          }}
          className="px-input mr-1 h-9 shrink-0 px-1.5 text-sm"
        >
          {LOG_FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <Sep />
        <Tool label="굵게" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <b className="font-sans text-base">B</b>
        </Tool>
        <Tool label="기울임" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <i className="font-serif text-lg">I</i>
        </Tool>
        <Tool label="밑줄" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
          <span className="text-base underline">U</span>
        </Tool>
        <Tool label="취소선" active={state.strike} onClick={() => chain().toggleStrike().run()}>
          <span className="text-base line-through">S</span>
        </Tool>

        <Sep />
        <Tool label="형광펜" active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
          <span className="bg-[#ffe066] px-0.5 text-sm text-ink">가</span>
        </Tool>
        <Tool label="글자색" active={popup === 'color'} onClick={() => setPopup((p) => (p === 'color' ? null : 'color'))}>
          <span className="size-4 border-2 border-ink" style={{ backgroundColor: state.color ?? '#1f2542' }} />
        </Tool>

        <Sep />
        <Tool label="링크" active={state.link} onClick={() => (state.link ? chain().unsetLink().run() : setLinkOpen(true))}>
          <LinkIcon />
        </Tool>
        <Tool label="이미지 넣기" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <Spinner className="size-4" /> : <PicIcon />}
        </Tool>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) onPickImages(files)
          }}
        />

        <Sep />
        <Tool label="정렬" active={popup === 'align'} onClick={() => setPopup((p) => (p === 'align' ? null : 'align'))}>
          <AlignIcon align={state.align} />
        </Tool>
        <Tool label="표 넣기" active={state.table} onClick={() => chainAtEnd().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()}>
          <TableIcon />
        </Tool>
        <Tool label="인용" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
          <span className="font-title text-lg leading-none">66</span>
        </Tool>
        <Tool label="구분선" onClick={() => chainAtEnd().setHorizontalRule().run()}>
          <span className="w-5 border-t-2 border-dashed border-current" />
        </Tool>

        <Sep />
        <Tool label="글머리 목록" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
          <ListIcon />
        </Tool>
        <Tool label="번호 목록" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
          <OrderedIcon />
        </Tool>
        <Tool label="내어쓰기" disabled={!state.inList} onClick={() => chain().liftListItem('listItem').run()}>
          <IndentIcon out />
        </Tool>
        <Tool label="들여쓰기" disabled={!state.inList} onClick={() => chain().sinkListItem('listItem').run()}>
          <IndentIcon />
        </Tool>
      </div>

      {/* 글자색 고르기 */}
      {popup === 'color' && (
        <div className="flex flex-wrap items-center gap-1.5 border-t-2 border-dashed border-gray-300 px-2 py-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              chain().unsetColor().run()
              setPopup(null)
            }}
            className="px-winbtn h-8 px-2 text-xs"
          >
            기본
          </button>
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`글자색 ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                chain().setColor(c).run()
                setPopup(null)
              }}
              style={{ backgroundColor: c }}
              className={`size-8 border-2 border-ink ${state.color === c ? 'outline-2 outline-offset-1 outline-accent' : ''}`}
            />
          ))}
        </div>
      )}

      {/* 정렬 고르기 */}
      {popup === 'align' && (
        <div className="flex gap-1.5 border-t-2 border-dashed border-gray-300 px-2 py-2">
          {(
            [
              ['left', '왼쪽'],
              ['center', '가운데'],
              ['right', '오른쪽'],
              ['justify', '양쪽'],
            ] as const
          ).map(([a, label]) => (
            <button
              key={a}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                chain().setTextAlign(a).run()
                setPopup(null)
              }}
              className={`px-winbtn h-8 gap-1 px-2 text-xs ${state.align === a ? 'bg-accent! text-paper!' : ''}`}
            >
              <AlignIcon align={a} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 표 안에 있을 때만: 줄·칸 추가/삭제 */}
      {state.table && (
        <div className="flex flex-wrap gap-1.5 border-t-2 border-dashed border-gray-300 px-2 py-2 text-xs">
          <MiniBtn onClick={() => chain().addRowAfter().run()}>+ 줄</MiniBtn>
          <MiniBtn onClick={() => chain().addColumnAfter().run()}>+ 칸</MiniBtn>
          <MiniBtn onClick={() => chain().deleteRow().run()}>− 줄</MiniBtn>
          <MiniBtn onClick={() => chain().deleteColumn().run()}>− 칸</MiniBtn>
          <MiniBtn onClick={() => chain().deleteTable().run()} danger>
            표 삭제
          </MiniBtn>
        </div>
      )}

      <PromptModal
        open={linkOpen}
        title="링크 넣기"
        label="주소 (https://…)"
        placeholder="https://"
        maxLength={2000}
        submitText="넣기"
        onSubmit={async (value) => {
          const href = /^(https?:\/\/|mailto:)/i.test(value) ? value : `https://${value}`
          if (!/^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(href)) throw new Error('올바른 주소를 입력해 주세요.')
          const { empty } = editor.state.selection
          if (empty) {
            // 글자를 안 골랐으면 주소 자체를 링크 글자로 넣음
            chain().insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href } }] }).run()
          } else {
            chain().extendMarkRange('link').setLink({ href }).run()
          }
        }}
        onClose={() => setLinkOpen(false)}
      />
    </div>
  )
}

function Tool({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // 버튼을 눌러도 편집 중인 글의 선택이 풀리지 않게
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex size-9 shrink-0 items-center justify-center border-2 disabled:opacity-30 ${
        active ? 'border-ink bg-ink text-paper' : 'border-transparent text-ink active:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-6 w-0.5 shrink-0 bg-gray-300" />
}

function MiniBtn({ onClick, danger = false, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-winbtn h-8 px-2.5 ${danger ? 'text-red-600!' : ''}`}
    >
      {children}
    </button>
  )
}

// ---------------- 툴바 아이콘 (픽셀 느낌) ----------------
const svg = 'size-5'
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden>
      <path d="M10 14l4-4M8 11l-3 3a3 3 0 0 0 4 4l3-3M16 13l3-3a3 3 0 0 0-4-4l-3 3" />
    </svg>
  )
}
function PicIcon() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M3 17l6-6 5 5 3-3 4 4" />
      <rect x="15" y="7" width="2" height="2" fill="currentColor" />
    </svg>
  )
}
function AlignIcon({ align }: { align: 'left' | 'center' | 'right' | 'justify' }) {
  const lines = {
    left: ['M4 6h16', 'M4 10h10', 'M4 14h16', 'M4 18h10'],
    center: ['M4 6h16', 'M7 10h10', 'M4 14h16', 'M7 18h10'],
    right: ['M4 6h16', 'M10 10h10', 'M4 14h16', 'M10 18h10'],
    justify: ['M4 6h16', 'M4 10h16', 'M4 14h16', 'M4 18h16'],
  }[align]
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden>
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M3 10h18M3 15h18M10 4v16" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <rect x="4" y="5" width="2" height="2" fill="currentColor" />
      <rect x="4" y="11" width="2" height="2" fill="currentColor" />
      <rect x="4" y="17" width="2" height="2" fill="currentColor" />
    </svg>
  )
}
function OrderedIcon() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 4h2v4M4 11h3l-3 3h3M4 17h3v3H4" strokeWidth="1.6" />
    </svg>
  )
}
function IndentIcon({ out = false }: { out?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden>
      <path d="M4 5h16M11 10h9M11 14h9M4 19h16" />
      <path d={out ? 'M8 9l-4 3 4 3' : 'M4 9l4 3-4 3'} />
    </svg>
  )
}
