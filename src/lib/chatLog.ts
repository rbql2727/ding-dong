/**
 * 채팅 로그 — 붙여넣은 채팅을 문단으로 나누고, 문단마다 종류(말풍선·지문·번역·상태창)를 고르는 기능
 * (사용자가 준 log-editor 모듈을 앱에 맞게 TypeScript 로 옮김. 화면·라이브러리와 무관한 순수 로직)
 *
 * 저장 형식 (character_logs.body):  {"type":"chat","v":1,"parts":[ { "t": "me", "text": "..." }, ... ]}
 *
 * part.t
 *   me      유저 말풍선 (오른쪽)
 *   them    캐릭터 말풍선 (왼쪽, who = 이름표. 없으면 캐릭터 이름)
 *   narr    지문
 *   tr      번역 병기 — 보기 화면에서 바로 앞 말풍선 아래에 붙음
 *   status  상태창 — 이어진 상태창은 한 카드로 합쳐짐
 * hidden: true  → 정리 화면에서 지운 문단 (보기 화면에 안 나옴)
 */

export type ChatPartType = 'me' | 'narr' | 'them' | 'tr' | 'status'
export type ChatPart = { t: ChatPartType; text: string; who?: string; hidden?: boolean }

export const CHAT_TYPES: [ChatPartType, string][] = [
  ['me', '유저 말풍선'],
  ['narr', '지문'],
  ['them', '캐릭터 말풍선'],
  ['tr', '번역 병기'],
  ['status', '상태창'],
]
export const CHAT_TYPE_NAME = Object.fromEntries(CHAT_TYPES) as Record<ChatPartType, string>

// ---------------------------------------------------------------------
// 1) 붙여넣은 글 → 문단 (종류는 자동 짐작)
//   ``` 사이, > 로 시작하는 줄 → 상태창
//   "유저:" "캐릭터:" 로 시작하면 그 뒤로 차례가 바뀜 (처음엔 캐릭터 차례)
//   *별표 사이* → 지문, 그 밖의 글 → 그 차례의 말풍선
//   말풍선 바로 뒤의 『…』 → 번역 병기
//   줄 맨 앞 **이름** → 말풍선 이름표 / 이미지 링크 ![..](..) 는 지움 / - 만 있는 줄은 건너뜀
// ---------------------------------------------------------------------
const MARK = /^(유저|나|user|User|캐릭터|char)\s*[:：]\s*/
const unquote = (s: string) => s.replace(/^["“]([^"“”]*)["”]$/, '$1')

export function parseChat(body: string): ChatPart[] {
  const out: ChatPart[] = []
  let turn: 'me' | 'them' = 'them'
  let code: string | null = null
  let m: RegExpMatchArray | null
  const lines = String(body || '').replace(/\r/g, '').split('\n')

  for (const raw of lines) {
    if (code !== null) {
      if (raw.trim().startsWith('```')) {
        if (code.trim()) out.push({ t: 'status', text: code.trim() })
        code = null
      } else code += (code ? '\n' : '') + raw.replace(/\s+$/, '')
      continue
    }
    let line = raw.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim()
    if (line.startsWith('```')) {
      code = ''
      continue
    }
    if (!line || /^[-—_=~·]+$/.test(line)) continue
    if (line.startsWith('>')) {
      out.push({ t: 'status', text: line.replace(/^>\s?/, '') })
      continue
    }
    if ((m = line.match(MARK))) {
      turn = /^(캐릭터|char)$/.test(m[1]) ? 'them' : 'me'
      line = line.slice(m[0].length).trim()
      if (!line) continue
    }
    let who = ''
    if ((m = line.match(/^\*\*([^*]{1,20})\*\*\s*[|Ι｜:：]?\s*/))) {
      who = m[1].trim()
      line = line.slice(m[0].length)
    }
    for (const chunk of line.split(/(\*[^*]+\*)/)) {
      const t = chunk.trim()
      if (!t) continue
      const isNarr = /^\*[^*]+\*$/.test(t)
      const inner = isNarr ? t.slice(1, -1).trim() : unquote(t.replace(/\*+/g, '').trim())
      if (!inner) continue
      const tm = inner.match(/^『([\s\S]+)』$/)
      const prev = out[out.length - 1]
      if (tm && prev && (prev.t === 'them' || prev.t === 'me')) {
        out.push({ t: 'tr', text: tm[1] })
        continue
      }
      if (isNarr) out.push({ t: 'narr', text: inner })
      else out.push(turn === 'them' ? { t: 'them', text: inner, who } : { t: 'me', text: inner })
    }
  }
  if (code && code.trim()) out.push({ t: 'status', text: code.trim() })
  return out
}

// ---------------------------------------------------------------------
// 2) 보기 화면용 묶음: 지운 문단 빼고, 번역은 앞 말풍선 아래에, 이어진 상태창은 한 카드로
// ---------------------------------------------------------------------
export type ChatGroup = { t: ChatPartType; text: string; who: string; subs: string[] }

export function groupForView(parts: ChatPart[], charName: string): ChatGroup[] {
  const g: ChatGroup[] = []
  for (const p of parts) {
    if (p.hidden) continue
    const prev = g[g.length - 1]
    if (p.t === 'tr' && prev && (prev.t === 'them' || prev.t === 'me')) {
      prev.subs.push(p.text)
      continue
    }
    if (p.t === 'status' && prev && prev.t === 'status') {
      prev.text += '\n' + p.text
      continue
    }
    g.push({ t: p.t, text: p.text, who: p.t === 'them' ? p.who || charName : '', subs: [] })
  }
  return g
}

// ---------------------------------------------------------------------
// 3) 저장·불러오기 + 보안 정리 (허용된 종류·길이만)
// ---------------------------------------------------------------------
const TYPE_SET = new Set<string>(CHAT_TYPES.map(([t]) => t))
const MAX_PARTS = 5000
const MAX_TEXT = 10000

export function isChatBody(body: string): boolean {
  return body.trimStart().startsWith('{"type":"chat"')
}

/** 어떤 값이 와도 안전한 문단 배열로 정리 (모르는 종류·속성은 버림) */
export function sanitizeChatParts(raw: unknown): ChatPart[] {
  if (!Array.isArray(raw)) return []
  const out: ChatPart[] = []
  for (const item of raw.slice(0, MAX_PARTS)) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.t !== 'string' || !TYPE_SET.has(r.t) || typeof r.text !== 'string') continue
    const text = r.text.slice(0, MAX_TEXT)
    if (!text.trim()) continue
    const part: ChatPart = { t: r.t as ChatPartType, text }
    if (part.t === 'them' && typeof r.who === 'string' && r.who.trim()) part.who = r.who.trim().slice(0, 30)
    if (r.hidden === true) part.hidden = true
    out.push(part)
  }
  return out
}

export function parseChatBody(body: string): ChatPart[] {
  try {
    const data = JSON.parse(body) as { parts?: unknown }
    return sanitizeChatParts(data.parts)
  } catch {
    return []
  }
}

export function serializeChat(parts: ChatPart[]): string {
  const clean = sanitizeChatParts(parts)
  return clean.length ? JSON.stringify({ type: 'chat', v: 1, parts: clean }) : ''
}

/** 목록 미리보기 글 */
export function chatPreview(body: string, max = 100): string {
  const plain = parseChatBody(body)
    .filter((p) => !p.hidden && p.t !== 'status')
    .map((p) => p.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max) + '…' : plain
}
