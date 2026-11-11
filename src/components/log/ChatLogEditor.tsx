import { useImperativeHandle, useState, type Ref } from 'react'
import { CHAT_TYPES, CHAT_TYPE_NAME, parseChat, serializeChat, type ChatPart, type ChatPartType } from '../../lib/chatLog'
import { Button } from '../ui'
import { ChatLogView } from './ChatLogView'

export type ChatLogEditorHandle = {
  /** 저장용 본문 (비었으면 '') */
  getBody: () => string
}

/**
 * 채팅 로그 정리 화면
 *  1) 채팅을 붙여넣고 [문단 나누기] → 종류 자동 짐작
 *  2) 문단을 누르면 종류 고르기, 왼쪽 위 × 로 숨기기(↺ 로 되살리기)
 *  3) [미리보기] 로 완성 모양 확인
 */
export function ChatLogEditor({
  initialParts,
  charName,
  ref,
}: {
  initialParts: ChatPart[]
  charName: string
  ref?: Ref<ChatLogEditorHandle>
}) {
  const [parts, setParts] = useState<ChatPart[]>(initialParts)
  const [source, setSource] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [preview, setPreview] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(initialParts.length === 0)

  useImperativeHandle(ref, () => ({ getBody: () => serializeChat(parts) }))

  function split() {
    const next = parseChat(source)
    if (next.length === 0) return
    // 이미 정리한 문단이 있으면 뒤에 이어 붙임
    setParts((prev) => [...prev, ...next])
    setSource('')
    setSelected(null)
    setPasteOpen(false)
  }

  function setType(i: number, t: ChatPartType) {
    setParts((prev) => prev.map((p, k) => (k === i ? { ...p, t } : p)))
    setSelected(null)
  }

  function toggleHidden(i: number) {
    setParts((prev) => prev.map((p, k) => (k === i ? { ...p, hidden: !p.hidden } : p)))
    if (selected === i) setSelected(null)
  }

  const visibleCount = parts.filter((p) => !p.hidden).length
  // 문단마다 "직전 말풍선이 어느 쪽인지" (번역 병기를 같은 쪽에 보여 주기 위해)
  const sides: ('me' | 'them')[] = []
  for (const p of parts) {
    const prev = sides[sides.length - 1] ?? 'them'
    sides.push(p.t === 'me' || p.t === 'them' ? p.t : prev)
  }

  return (
    <div className="px-window">
      {/* 붙여넣기 */}
      {pasteOpen ? (
        <div className="space-y-2 border-b-3 border-ink bg-gray-50 p-3">
          <label htmlFor="chat-source" className="block text-sm font-bold">
            <span className="text-accent">* </span>채팅 붙여넣기
          </label>
          <textarea
            id="chat-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={'유저: *문을 연다.* 안녕하세요?\n캐릭터: *고개를 든다.* 어서 오세요.\n**서하** | "Leave it there."\n*『거기 두세요.』*\n```\n📍 고서점 · 밤 11시\n```'}
            className="px-input field-sizing-content min-h-36 w-full resize-none px-3 py-2 font-mono text-sm leading-relaxed"
          />
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer py-1 font-bold text-gray-600">자동으로 나누는 규칙</summary>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>
                <code>유저:</code> / <code>캐릭터:</code> 로 시작하는 줄부터 그 사람 차례 (표시가 없으면 캐릭터)
              </li>
              <li>
                <code>*별표 사이*</code> → 지문, 그 밖의 글 → 말풍선
              </li>
              <li>
                줄 맨 앞 <code>**이름**</code> → 말풍선 이름표
              </li>
              <li>
                말풍선 바로 뒤의 <code>『…』</code> → 번역 병기
              </li>
              <li>
                <code>```</code> 사이, <code>&gt;</code> 로 시작하는 줄 → 상태창
              </li>
              <li>이미지 링크는 지워지고, - 만 있는 줄은 건너뜀. 틀리게 나뉘어도 아래에서 눌러 바꾸면 돼요.</li>
            </ul>
          </details>
          <div className="flex gap-2">
            {parts.length > 0 && (
              <Button type="button" variant="secondary" className="h-10 text-sm" onClick={() => setPasteOpen(false)}>
                닫기
              </Button>
            )}
            <Button type="button" className="h-10 text-sm" onClick={split} disabled={!source.trim()}>
              문단 나누기{parts.length > 0 ? ' (뒤에 이어 붙이기)' : ''}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b-3 border-ink bg-gray-50 px-3 py-2">
          <span className="flex-1 text-xs text-gray-500">
            문단 {parts.length}개 · 보이는 문단 {visibleCount}개
          </span>
          <button type="button" onClick={() => setPasteOpen(true)} className="px-winbtn h-9 px-3 text-xs">
            + 더 붙여넣기
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview((v) => !v)
              setSelected(null)
            }}
            className={`px-winbtn h-9 px-3 text-xs ${preview ? 'bg-ink! text-paper!' : ''}`}
            aria-pressed={preview}
          >
            {preview ? '정리하기' : '미리보기'}
          </button>
        </div>
      )}

      {/* 정리 화면 / 미리보기 */}
      <div className="p-3">
        {parts.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">채팅을 붙여넣고 [문단 나누기]를 눌러 주세요.</p>
        ) : preview ? (
          <ChatLogView parts={parts} charName={charName} />
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-500">문단을 누르면 종류를 고를 수 있어요. 왼쪽 위 ×는 숨기기, ↺는 되살리기예요.</p>
            <div className="chat-log chat-editing">
              {parts.map((p, i) => {
                const side = sides[i]
                const isSel = selected === i
                const right = p.t === 'me' || (p.t === 'tr' && side === 'me')
                const label = (p.t === 'them' ? `캐릭터 · ${p.who || charName}` : CHAT_TYPE_NAME[p.t]) + (p.hidden ? ' · 숨김' : '')
                const cls = p.t === 'tr' ? `chat-tr chat-tr-${side}` : `chat-${p.t}`
                return (
                  <div key={i} className={`flex flex-col ${right ? 'items-end' : 'items-start'} ${p.t === 'narr' || p.t === 'status' ? 'items-stretch!' : ''}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isSel}
                      onClick={() => setSelected(isSel ? null : i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(isSel ? null : i)
                        }
                      }}
                      className={`chat-msg ${cls} ${p.hidden ? 'chat-hidden' : ''} ${isSel ? 'chat-selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="chat-x"
                        aria-label={p.hidden ? '문단 되살리기' : '문단 숨기기'}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleHidden(i)
                        }}
                      >
                        {p.hidden ? '↺' : '×'}
                      </button>
                      <span className="chat-kind">{label}</span>
                      <span className="chat-txt">{p.text}</span>
                    </div>
                    {isSel && (
                      <div className={`mt-2 flex max-w-full flex-wrap gap-1.5 ${right ? 'justify-end' : ''}`}>
                        {CHAT_TYPES.map(([t, name]) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setType(i, t)}
                            className={`px-winbtn h-9 px-2.5 text-xs ${t === p.t ? 'bg-accent! text-paper!' : ''}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
