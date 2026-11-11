import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { addCharacterImages, listCharacters } from '../../data/characters'
import { listLogs, updateLog, uploadLogImage } from '../../data/logs'
import { listMyWikis } from '../../data/wikis'
import { BackHeader, Button } from '../../components/ui'
import { isChatBody } from '../../lib/chatLog'
import { isDocBody } from '../../lib/logDocCore'

/**
 * Naru 102호 → OC 위키 이미지 가져오기 (한 번 쓰는 도구)
 *
 * 글(캐릭터·로그)은 이미 DB 로 옮겨 둠. 여기서는 브라우저가 Naru 에서 이미지를 받아
 * 줄여서(원본 1600px + 썸네일 400px) 내 저장소에 올리고 붙입니다.
 * - 캐릭터: Naru data.js 의 image(액자) + full(전신) → 캐릭터 이미지 2장, 액자를 대표 이미지로
 * - 로그: 본문의 "[🖼 img/...]" 표시 → 실제 그림으로 교체
 * 이미 이미지가 있는 캐릭터, 표시가 없는 로그는 건너뜀 → 여러 번 눌러도 안전.
 */

const NARU_BASE = 'https://ding-dong.naru.pub/102/'
/** 가져온 위키 구분용 (위키 소개 첫머리) */
const WIKI_MARK = 'Naru 102호'

/** Naru data.js 에서 옮겨 적은 캐릭터 그림 경로: [액자, 전신] */
const CHARACTER_IMAGES: Record<string, [string, string]> = {
  시안: ['img/berserk/c3.png', 'full/c_full.png'],
  포트: ['img/berserk/port3_2.png', 'full/p_full.png'],
  루엘: ['img/berserk/re.png', 'full/re_full2.png'],
  '하야미 렌': ['img/themis/hym2.jpg', 'full/hym_full.png'],
  차은결: ['img/themis/ek2.jpg', 'full/ek_full.png'],
  남주안: ['img/themis/ja.png', 'full/ja_full.png'],
  윤무영: ['img/themis/my2.png', 'full/my_full2.png'],
  전시우: ['img/themis/nm.png', 'full/nm_full.png'],
  채이현: ['img/themis/buff.png', 'full/buff_full.png'],
  '유진 밀러': ['img/aftermess/yuj.png', 'full/yj_full2.png'],
  '카이든 블레이크': ['img/aftermess/kai.png', 'full/kai_full.png'],
  '12': ['img/aftermess/12_1.png', 'full/12_full.png'],
  '사오토메 유우마': ['img/aftermess/ym1.png', 'full/ym_full2.png'],
  강이솔: ['img/annibus/sol.png', 'full/sol_full.png'],
  '베리스 헤이워드': ['img/annibus/veris.jpg', 'full/b_full.png'],
  '올리버 브릭스': ['img/annibus/oliver.png', 'full/oli_full.png'],
  vV최강Vv: ['img/bluefairy/lr.jpg', 'full/lr_full.png'],
  정진우: ['img/solo/jinw.png', 'full/jw_full2.png'],
  강하진: ['img/solo/hj.png', 'full/hj_full.png'],
  '카밀 하사닌': ['img/solo/Kamill.png', 'full/km_full2.png'],
}

const MARKER = /\[🖼 ([^\]\n]+)\]/g

/** Naru 파일 받기 → File (Naru 는 다른 사이트에서 가져가는 것을 허용함) */
async function fetchNaru(path: string): Promise<File> {
  const url = /^https?:\/\//.test(path) ? path : NARU_BASE + path.replace(/^\.?\//, '')
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`그림을 받지 못했어요 (${res.status}): ${path}`)
  const blob = await res.blob()
  const name = path.split('/').pop() || 'image'
  return new File([blob], name, { type: blob.type || (name.endsWith('.png') ? 'image/png' : 'image/jpeg') })
}

type Line = { text: string; tone: 'ok' | 'skip' | 'fail' | 'info' }

export function NaruImportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [counts, setCounts] = useState({ chars: 0, logImages: 0, fails: 0 })

  const add = (text: string, tone: Line['tone']) => setLines((l) => [...l, { text, tone }])

  async function run() {
    if (!user) return
    setRunning(true)
    setDone(false)
    setLines([])
    const c = { chars: 0, logImages: 0, fails: 0 }
    try {
      const wikis = (await listMyWikis(user.id)).filter((w) => w.description.startsWith(WIKI_MARK))
      if (wikis.length === 0) add('Naru 에서 옮겨 온 위키가 없어요. (이 계정이 맞나요?)', 'fail')

      for (const wiki of wikis) {
        add(`📁 ${wiki.name}`, 'info')
        const characters = await listCharacters(wiki.id)
        for (const ch of characters) {
          // 1) 캐릭터 이미지
          const paths = CHARACTER_IMAGES[ch.name]
          if (!paths) {
            add(`${ch.name}: Naru 그림 정보 없음 — 건너뜀`, 'skip')
          } else if (ch.thumbUrl) {
            add(`${ch.name}: 이미 이미지가 있어서 건너뜀`, 'skip')
          } else {
            try {
              const files = await Promise.all(paths.map(fetchNaru))
              await addCharacterImages(user.id, wiki.id, ch.id, files, { setCoverToFirst: true })
              c.chars++
              add(`${ch.name}: 이미지 ${files.length}장 올림 (액자 = 대표 이미지)`, 'ok')
            } catch (err) {
              c.fails++
              add(`${ch.name}: 실패 — ${(err as Error).message}`, 'fail')
            }
          }

          // 2) 로그 본문의 그림 표시
          const logs = await listLogs(ch.id)
          for (const log of logs) {
            if (isChatBody(log.body) || isDocBody(log.body)) continue // 채팅 로그·링크 문서는 그림 표시 없음
            const markers = [...log.body.matchAll(MARKER)]
            if (markers.length === 0) continue
            let body = log.body
            let replaced = 0
            for (const m of markers) {
              try {
                const file = await fetchNaru(m[1].trim())
                const url = await uploadLogImage(user.id, wiki.id, ch.id, file)
                // 그림은 한 줄을 통째로 차지해야 해서 앞뒤로 줄바꿈
                body = body.replace(m[0], `\n![이미지](${url})\n`)
                replaced++
              } catch (err) {
                c.fails++
                add(`  「${log.title}」 그림 실패 — ${(err as Error).message}`, 'fail')
              }
            }
            if (replaced > 0) {
              body = body.replace(/\n{3,}/g, '\n\n')
              await updateLog(log.id, log.title, body)
              c.logImages += replaced
              add(`  「${log.title}」 그림 ${replaced}장 넣음`, 'ok')
            }
          }
          setCounts({ ...c })
        }
      }
      add('끝났어요!', 'info')
      setDone(true)
    } catch (err) {
      c.fails++
      add(`중간에 멈췄어요 — ${(err as Error).message}. 다시 누르면 남은 것만 이어서 해요.`, 'fail')
    } finally {
      setCounts({ ...c })
      setRunning(false)
    }
  }

  const toneClass = { ok: 'text-emerald-700', skip: 'text-gray-400', fail: 'text-red-600', info: 'font-bold text-ink' }

  return (
    <div className="pb-16">
      <BackHeader title="Naru 이미지 가져오기" onBack={() => navigate('/wikis')} />
      <div className="space-y-4 px-4 pt-4 lg:mx-auto lg:max-w-2xl lg:px-8 lg:pt-8">
        <div className="px-window space-y-2 p-4 text-sm leading-relaxed text-gray-700">
          <p>
            Naru 102호에서 옮겨 온 위키 6개에 <b>캐릭터 그림(액자·전신)</b>과 <b>로그 속 그림</b>을 넣어요.
          </p>
          <p>브라우저가 Naru 에서 그림을 받아 크기를 줄여 올리기 때문에, 끝날 때까지 이 화면을 켜 두세요. (몇 분 걸려요)</p>
          <p className="text-gray-500">이미 그림이 있는 캐릭터와 이미 바꾼 로그는 건너뛰니, 중간에 멈추면 다시 눌러도 돼요.</p>
        </div>

        <Button onClick={run} loading={running} disabled={running}>
          {done ? '다시 확인하기' : '가져오기 시작'}
        </Button>

        {(running || lines.length > 0) && (
          <p className="text-sm">
            캐릭터 <b>{counts.chars}</b>명 · 로그 그림 <b>{counts.logImages}</b>장 완료
            {counts.fails > 0 && <span className="text-red-600"> · 실패 {counts.fails}</span>}
          </p>
        )}

        {lines.length > 0 && (
          <ul className="px-window max-h-[50vh] space-y-1 overflow-y-auto p-3 font-mono text-xs">
            {lines.map((l, i) => (
              <li key={i} className={toneClass[l.tone]}>
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
