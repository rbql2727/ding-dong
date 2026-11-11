/**
 * 로그 본문(문서) 처리 — 화면·라이브러리와 무관한 순수 로직 (테스트하기 쉽게 분리)
 *
 * 저장 형식: 편집기(TipTap) 문서를 JSON 문자열로 저장  {"type":"doc","content":[...]}
 * 예전 형식(2~3단계): 일반 글 + **굵게** + 한 줄짜리 ![설명](주소) 이미지 → 불러올 때 문서로 변환
 *
 * ★ 보안: 보여 주기 전에 반드시 sanitizeDoc() 을 거칩니다.
 *   허용 목록에 있는 요소·속성만 남기고 나머지는 버립니다.
 *   (앱을 거치지 않고 DB 에 직접 이상한 문서를 넣어도, 스크립트·외부 이미지·이상한 스타일이 들어가지 않게)
 */

export type DocNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

/** 글꼴 목록 — 편집기 선택지와 허용 목록이 같아야 함 */
export const LOG_FONTS = [
  { label: '프리텐다드', value: "'Pretendard Variable', Pretendard, sans-serif" },
  { label: '노토산스', value: "'Noto Sans KR', sans-serif" },
  { label: '갈무리', value: "Galmuri11, 'Noto Sans KR', sans-serif" },
  // 굴림·바탕은 Windows 글꼴이라 앱에 넣을 수 없음 → 깔린 기기에서만 그 모양, 없으면 비슷한 글꼴로
  { label: '굴림', value: "Gulim, 굴림, 'Noto Sans KR', sans-serif" },
  { label: '바탕', value: "Batang, 바탕, 'Noto Serif KR', 'Nanum Myeongjo', serif" },
] as const
export const DEFAULT_LOG_FONT = LOG_FONTS[0]

/** 글자색 고르기용 */
export const TEXT_COLORS = ['#1f2542', '#e66b2c', '#d6336c', '#c92a2a', '#e8590c', '#f59f00', '#2f9e44', '#1c7ed6', '#7048e8', '#868e96']

const MAX_DEPTH = 30
const MAX_NODES = 20000

const ALIGN = new Set(['left', 'center', 'right', 'justify'])
const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i
const LINK_RE = /^(https?:\/\/|mailto:)[^\s"'<>]+$/i
const FONT_VALUES = new Set<string>(LOG_FONTS.map((f) => f.value))

/** 블록 요소 → 허용 속성 정리 함수 */
const NODE_RULES: Record<string, (attrs: Record<string, unknown>, ctx: Ctx) => Record<string, unknown> | null | undefined> = {
  doc: () => undefined,
  paragraph: (a) => alignOnly(a),
  text: () => undefined,
  hardBreak: () => undefined,
  bulletList: () => undefined,
  orderedList: (a) => {
    const start = Number(a.start)
    return { start: Number.isInteger(start) && start >= 1 && start <= 9999 ? start : 1 }
  },
  listItem: () => undefined,
  blockquote: () => undefined,
  horizontalRule: () => undefined,
  table: () => undefined,
  tableRow: () => undefined,
  tableCell: (a) => cellAttrs(a),
  tableHeader: (a) => cellAttrs(a),
  // 이미지는 우리 Storage 주소만. 아니면 통째로 버림(null)
  image: (a, ctx) => {
    const src = typeof a.src === 'string' ? a.src : ''
    if (!ctx.isAllowedImage(src)) return null
    return { src, alt: typeof a.alt === 'string' ? a.alt.slice(0, 200) : null }
  },
}

/** 글자 꾸밈 → 허용 속성 정리 함수 */
const MARK_RULES: Record<string, (attrs: Record<string, unknown>) => Record<string, unknown> | null | undefined> = {
  bold: () => undefined,
  italic: () => undefined,
  underline: () => undefined,
  strike: () => undefined,
  highlight: () => undefined,
  link: (a) => {
    const href = typeof a.href === 'string' ? a.href.trim() : ''
    if (!LINK_RE.test(href)) return null
    return { href, target: '_blank', rel: 'noopener noreferrer nofollow' }
  },
  textStyle: (a) => {
    const out: Record<string, unknown> = {}
    if (typeof a.color === 'string' && COLOR_RE.test(a.color.trim())) out.color = a.color.trim()
    if (typeof a.fontFamily === 'string' && FONT_VALUES.has(a.fontFamily)) out.fontFamily = a.fontFamily
    return Object.keys(out).length ? out : null
  },
}

type Ctx = { isAllowedImage: (src: string) => boolean; count: number }

function alignOnly(a: Record<string, unknown>) {
  return { textAlign: typeof a.textAlign === 'string' && ALIGN.has(a.textAlign) ? a.textAlign : null }
}

function cellAttrs(a: Record<string, unknown>) {
  const int = (v: unknown, max: number) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= max ? n : 1
  }
  const colwidth = Array.isArray(a.colwidth)
    ? a.colwidth.map((w) => (Number.isInteger(w) && (w as number) > 0 && (w as number) <= 2000 ? (w as number) : null))
    : null
  return { colspan: int(a.colspan, 20), rowspan: int(a.rowspan, 50), colwidth: colwidth?.some((w) => w !== null) ? colwidth : null }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function cleanNode(raw: unknown, ctx: Ctx, depth: number): DocNode | null {
  if (depth > MAX_DEPTH || ctx.count++ > MAX_NODES) return null
  const node = asRecord(raw)
  const type = typeof node.type === 'string' ? node.type : ''
  const rule = NODE_RULES[type]
  if (!rule) return null

  const attrs = rule(asRecord(node.attrs), ctx)
  if (attrs === null) return null
  const out: DocNode = { type }
  if (attrs) out.attrs = attrs

  if (type === 'text') {
    if (typeof node.text !== 'string' || node.text === '') return null
    out.text = node.text.slice(0, 100000)
    if (Array.isArray(node.marks)) {
      const marks = node.marks
        .map((m) => {
          const mr = asRecord(m)
          const mtype = typeof mr.type === 'string' ? mr.type : ''
          const mrule = MARK_RULES[mtype]
          if (!mrule) return null
          const mattrs = mrule(asRecord(mr.attrs))
          if (mattrs === null) return null
          return mattrs ? { type: mtype, attrs: mattrs } : { type: mtype }
        })
        .filter((m): m is NonNullable<typeof m> => !!m)
      if (marks.length) out.marks = marks
    }
    return out
  }

  if (Array.isArray(node.content)) {
    const children = node.content.map((c) => cleanNode(c, ctx, depth + 1)).filter((c): c is DocNode => !!c)
    if (children.length) out.content = children
  }
  return out
}

/** 허용 목록으로 문서 정리. 문서가 아니면 빈 문서 */
export function sanitizeDoc(raw: unknown, isAllowedImage: (src: string) => boolean): DocNode {
  const cleaned = cleanNode(raw, { isAllowedImage, count: 0 }, 0)
  if (!cleaned || cleaned.type !== 'doc') return { type: 'doc', content: [{ type: 'paragraph' }] }
  if (!cleaned.content?.length) cleaned.content = [{ type: 'paragraph' }]
  return cleaned
}

// ---------------------------------------------------------------------
// 저장된 본문 읽기
// ---------------------------------------------------------------------

/** 새 형식(JSON 문서)인지 */
export function isDocBody(body: string): boolean {
  return body.trimStart().startsWith('{"type":"doc"')
}

const LEGACY_IMAGE = /^!\[([^\]\n]*)\]\((\S+)\)$/
const LEGACY_BOLD = /\*\*(.+?)\*\*/g

/** 예전 형식(글 + **굵게** + 이미지 줄) → 문서 */
export function legacyToDoc(text: string): DocNode {
  const content: DocNode[] = text.split('\n').map((line) => {
    const img = line.trim().match(LEGACY_IMAGE)
    if (img) return { type: 'image', attrs: { src: img[2], alt: img[1] || null } }
    if (!line) return { type: 'paragraph' }
    const parts = line.split(LEGACY_BOLD)
    const texts: DocNode[] = parts
      .map((p, i) => (p ? ({ type: 'text', text: p, ...(i % 2 ? { marks: [{ type: 'bold' }] } : {}) } as DocNode) : null))
      .filter((n): n is DocNode => !!n)
    return texts.length ? { type: 'paragraph', content: texts } : { type: 'paragraph' }
  })
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

/** 저장된 본문 → (정리되지 않은) 문서 */
export function parseBody(body: string): DocNode {
  if (isDocBody(body)) {
    try {
      return JSON.parse(body) as DocNode
    } catch {
      return { type: 'doc', content: [{ type: 'paragraph' }] }
    }
  }
  return legacyToDoc(body)
}

function walk(node: DocNode, fn: (n: DocNode) => void) {
  fn(node)
  node.content?.forEach((c) => walk(c, fn))
}

/** 본문 속 이미지 주소 (지울 때 파일 정리용) */
export function docImageUrls(body: string, isAllowedImage: (src: string) => boolean): string[] {
  const urls: string[] = []
  walk(sanitizeDoc(parseBody(body), isAllowedImage), (n) => {
    if (n.type === 'image' && typeof n.attrs?.src === 'string') urls.push(n.attrs.src)
  })
  return urls
}

/** 목록 미리보기 글 (글자만, 앞부분) */
export function docPreview(body: string, max = 100): string {
  const parts: string[] = []
  const doc = parseBody(body)
  const visit = (n: DocNode) => {
    if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
    n.content?.forEach(visit)
    if (n.type !== 'text' && n.type !== 'hardBreak') parts.push(' ')
  }
  visit(doc)
  const plain = parts.join('').replace(/\s+/g, ' ').trim()
  return plain.length > max ? plain.slice(0, max) + '…' : plain
}

/** 내용이 비었는지 (글자도 이미지도 없음) */
export function isDocEmpty(doc: DocNode): boolean {
  let found = false
  walk(doc, (n) => {
    if ((n.type === 'text' && n.text?.trim()) || n.type === 'image' || n.type === 'horizontalRule' || n.type === 'table') found = true
  })
  return !found
}
