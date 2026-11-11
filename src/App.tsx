import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Status = 'checking' | 'ok' | 'no-env' | 'no-tables' | 'error'

/**
 * 1단계 임시 화면: Supabase 연결 상태만 확인합니다.
 * 실제 화면은 다음 단계에서 만듭니다.
 */
function App() {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? 'checking' : 'no-env')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase
      .from('wikis')
      .select('id', { head: true, count: 'exact' })
      .then(({ error }) => {
        if (!error) return setStatus('ok')
        setDetail(error.message)
        // 42P01 / PGRST205: 테이블이 아직 없음 (SQL을 아직 적용하지 않음)
        setStatus(error.code === '42P01' || error.code === 'PGRST205' ? 'no-tables' : 'error')
      })
  }, [])

  const messages: Record<Status, { text: string; tone: string }> = {
    checking: { text: '연결 확인 중…', tone: 'text-gray-500' },
    ok: { text: 'Supabase 연결 성공! 테이블도 준비되었습니다.', tone: 'text-emerald-600' },
    'no-env': { text: '.env 파일에 Supabase 키를 입력해 주세요.', tone: 'text-amber-600' },
    'no-tables': {
      text: '연결은 되었지만 테이블이 없습니다. SQL을 Supabase에 적용해 주세요.',
      tone: 'text-amber-600',
    },
    error: { text: '연결 중 오류가 발생했습니다.', tone: 'text-red-600' },
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">OC 위키</h1>
      <p className="text-sm text-gray-500">1단계: 준비 중</p>
      <p className={`font-medium ${messages[status].tone}`}>{messages[status].text}</p>
      {detail && <p className="break-all text-xs text-gray-400">{detail}</p>}
    </main>
  )
}

export default App
