import { chatPreview, groupForView, parseChat, parseChatBody, sanitizeChatParts, serializeChat } from '../src/lib/chatLog.ts'

let pass = 0
let fail = 0
const t = (name: string, cond: boolean) => {
  if (cond) pass++
  else fail++
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name)
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// 원본 모듈 demo.html 의 예시 글
const demo = `유저: *문을 밀고 들어선다.* 아직 영업하시나요?
캐릭터: *그녀는 책장 사이에서 고개만 내밀었다.* 문이 열려 있으면 영업 중이에요.
**서하** Ι "Leave your umbrella there."
*『우산은 거기 두세요.』*
\`\`\`
📍 고서점 · 밤 11시
\`\`\``
const parts = parseChat(demo)
t(
  '예시 글 나누기 (원본과 같은 결과)',
  eq(parts, [
    { t: 'narr', text: '문을 밀고 들어선다.' },
    { t: 'me', text: '아직 영업하시나요?' },
    { t: 'narr', text: '그녀는 책장 사이에서 고개만 내밀었다.' },
    { t: 'them', text: '문이 열려 있으면 영업 중이에요.', who: '' },
    { t: 'them', text: 'Leave your umbrella there.', who: '서하' },
    { t: 'tr', text: '우산은 거기 두세요.' },
    { t: 'status', text: '📍 고서점 · 밤 11시' },
  ]),
)
t('> 줄은 상태창', eq(parseChat('> HP 100'), [{ t: 'status', text: 'HP 100' }]))
t('이미지 링크·구분선 제거', eq(parseChat('![x](https://evil/t.png)\n---\n안녕'), [{ t: 'them', text: '안녕', who: '' }]))
t('표시 없으면 캐릭터 차례', parseChat('그냥 말')[0].t === 'them')
t('닫히지 않은 ``` 도 상태창', eq(parseChat('```\nLv 3'), [{ t: 'status', text: 'Lv 3' }]))

const g = groupForView(
  [
    { t: 'them', text: 'Hi', who: '' },
    { t: 'tr', text: '안녕' },
    { t: 'status', text: 'A' },
    { t: 'status', text: 'B' },
    { t: 'me', text: '숨김', hidden: true },
  ],
  '서하',
)
t('보기: 번역은 앞 말풍선 아래, 이름 없으면 캐릭터 이름', g[0].subs[0] === '안녕' && g[0].who === '서하')
t('보기: 이어진 상태창은 하나로', g.length === 2 && g[1].text === 'A\nB')
t('보기: 숨긴 문단은 빠짐', !g.some((x) => x.text === '숨김'))

// 보안 정리
const dirty = [
  { t: 'them', text: '<img src=x onerror=alert(1)>', who: '이름', onclick: 'x' },
  { t: 'script', text: 'x' },
  { t: 'me', text: 'hi', who: '유저에는 이름표 없음', hidden: 'yes' },
  { t: 'narr', text: 123 },
  null,
  'str',
]
const clean = sanitizeChatParts(dirty)
t('모르는 종류·잘못된 값 버림', clean.length === 2)
t('허용 속성만 남김', eq(clean[0], { t: 'them', text: '<img src=x onerror=alert(1)>', who: '이름' }) && eq(clean[1], { t: 'me', text: 'hi' }))
t('배열이 아니면 빈 배열', sanitizeChatParts({ t: 'me' }).length === 0 && sanitizeChatParts('x').length === 0)
t('이름표 30자 제한', (sanitizeChatParts([{ t: 'them', text: 'a', who: 'x'.repeat(100) }])[0].who ?? '').length === 30)

// 저장·불러오기
const body = serializeChat(parts)
t('저장 형식', body.startsWith('{"type":"chat","v":1,"parts":['))
t('저장 → 불러오기 그대로', eq(parseChatBody(body), sanitizeChatParts(parts)))
t('빈 로그는 빈 문자열', serializeChat([]) === '')
t('깨진 본문은 빈 배열', parseChatBody('{"type":"chat",').length === 0)
t('미리보기 (상태창·숨김 제외)', chatPreview(body).startsWith('문을 밀고 들어선다.') && !chatPreview(body).includes('고서점'))

console.log(`\n${pass} 통과 / ${fail} 실패`)
process.exit(fail ? 1 : 0)
