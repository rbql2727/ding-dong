import { sanitizeDoc, legacyToDoc, docPreview, docImageUrls, isDocEmpty, LOG_FONTS } from '../src/lib/logDocCore.ts'
const OK = 'https://x.supabase.co/storage/v1/object/public/media/u/wikis/w/characters/c/logs/a.webp'
const allow = (s: string) => s.startsWith('https://x.supabase.co/storage/v1/object/public/media/') && !s.includes('..')
let pass = 0, fail = 0
const t = (name: string, cond: boolean) => { if (cond) pass++; else fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name) }
const s = (doc: unknown) => JSON.stringify(sanitizeDoc(doc, allow))
const p = (inline: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: inline }] })

t('javascript: 링크 제거', !s(p([{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }])).includes('javascript'))
t('data: 링크 제거', !s(p([{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'data:text/html,<script>' } }] }])).includes('data:'))
t('https 링크는 유지 + rel 강제', s(p([{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://ok.com', onclick: 'x', target: '_self' } }] }])).includes('"href":"https://ok.com","target":"_blank","rel":"noopener noreferrer nofollow"'))
t('색 속성 CSS 주입 차단', !s(p([{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { color: 'red;background:url(https://evil/t.png)' } }] }])).includes('evil'))
t('정상 색은 유지', s(p([{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { color: '#e66b2c' } }] }])).includes('#e66b2c'))
t('목록에 없는 글꼴 제거', !s(p([{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { fontFamily: "x;}body{display:none" } }] }])).includes('display'))
t('허용 글꼴 유지', s(p([{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { fontFamily: LOG_FONTS[2].value } }] }])).includes('Galmuri11'))
t('외부 이미지 제거', !s({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://evil.com/track.gif' } }] }).includes('evil'))
t('우리 Storage 이미지 유지', s({ type: 'doc', content: [{ type: 'image', attrs: { src: OK, onerror: 'x' } }] }).includes(OK) && !s({ type: 'doc', content: [{ type: 'image', attrs: { src: OK, onerror: 'x' } }] }).includes('onerror'))
t('경로 조작(..) 이미지 제거', !s({ type: 'doc', content: [{ type: 'image', attrs: { src: OK.replace('logs/a', '../../x') } }] }).includes('image'))
t('모르는 요소(script/iframe) 제거', !/script|iframe|html/i.test(s({ type: 'doc', content: [{ type: 'script', text: 'alert(1)' }, { type: 'iframe', attrs: { src: 'x' } }, { type: 'html', text: '<b>' }] })))
t('모르는 꾸밈 제거', !s(p([{ type: 'text', text: 'x', marks: [{ type: 'evil', attrs: { style: 'x' } }] }])).includes('evil'))
t('정렬 값 허용 목록', s({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' } }] }).includes('center') && !s({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'x;color:red' } }] }).includes('color'))
t('표 칸 속성 숫자만', !s({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: '1;x', colwidth: ['100px;'] , style: 'x' } }] }] }] }).includes(';'))
t('문서가 아니면 빈 문서', s({ type: 'paragraph' }) === '{"type":"doc","content":[{"type":"paragraph"}]}' && s('문자열') === '{"type":"doc","content":[{"type":"paragraph"}]}')
const deep: any = { type: 'doc', content: [] }; let cur = deep; for (let i = 0; i < 200; i++) { const n = { type: 'blockquote', content: [] }; cur.content.push(n); cur = n }
t('너무 깊은 중첩은 잘라냄', s(deep).split('blockquote').length - 1 <= 31)
const legacy = legacyToDoc(`안녕 **굵게** 끝\n\n![이미지](${OK})\n마지막`)
t('예전 형식 변환: 굵게', JSON.stringify(legacy).includes('"text":"굵게","marks":[{"type":"bold"}]'))
t('예전 형식 변환: 이미지', JSON.stringify(legacy).includes(`"type":"image","attrs":{"src":"${OK}"`))
t('미리보기 글', docPreview(JSON.stringify(p([{ type: 'text', text: '첫 줄' }]))) === '첫 줄' && docPreview(`안녕 **굵게**\n![x](${OK})`) === '안녕 굵게')
t('본문 이미지 목록 (예전/새 형식)', docImageUrls(`![x](${OK})`, allow)[0] === OK && docImageUrls(JSON.stringify({ type: 'doc', content: [{ type: 'image', attrs: { src: OK } }, { type: 'image', attrs: { src: 'https://evil/x' } }] }), allow).length === 1)
t('빈 문서 판정', isDocEmpty({ type: 'doc', content: [{ type: 'paragraph' }] }) && !isDocEmpty(p([{ type: 'text', text: 'a' }])))
console.log(`\n${pass} 통과 / ${fail} 실패`)
process.exit(fail ? 1 : 0)
