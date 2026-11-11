import { groupForView, type ChatPart } from '../../lib/chatLog'

/**
 * 채팅 로그 보기 화면 (말풍선)
 * 모든 글자는 React 가 글자 그대로 넣으므로(HTML 로 해석 안 함) 스크립트 삽입 위험이 없음.
 */
export function ChatLogView({ parts, charName }: { parts: ChatPart[]; charName: string }) {
  const groups = groupForView(parts, charName)
  if (groups.length === 0) return <p className="text-sm text-gray-500">보이는 문단이 없어요.</p>
  return (
    <div className="chat-log">
      {groups.map((g, i) => {
        if (g.t === 'status') return <div key={i} className="chat-msg chat-status">{g.text}</div>
        if (g.t === 'narr') return <div key={i} className="chat-msg chat-narr">{g.text}</div>
        if (g.t === 'tr')
          return (
            <div key={i} className="chat-msg chat-them">
              <span className="chat-sub chat-sub-only">{g.text}</span>
            </div>
          )
        return (
          <div key={i} className={`chat-msg chat-${g.t}`}>
            {g.t === 'them' && <span className="chat-who">{g.who}</span>}
            {g.text}
            {g.subs.map((s, j) => (
              <span key={j} className="chat-sub">
                {s}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
