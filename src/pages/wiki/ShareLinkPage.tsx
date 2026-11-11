import { Link, Navigate, useParams } from 'react-router-dom'
import { redeemShareToken } from '../../data/sharing'
import { InlineLoading } from '../../components/ui'
import { useLoad } from '../../lib/useLoad'

/**
 * 공유 링크로 들어오는 곳 (/s/:token)
 * 로그인이 필요하고(보호 라우트), DB 가 토큰을 확인한 뒤 열람 기록을 남기면 위키로 이동.
 */
export function ShareLinkPage() {
  const { token = '' } = useParams()
  const { data: wikiId, loading, error } = useLoad(() => redeemShareToken(token), [token])

  if (loading) return <InlineLoading />
  if (wikiId) return <Navigate to={`/w/${wikiId}`} replace />
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-4xl" aria-hidden>
        🔗
      </p>
      <p className="font-semibold text-gray-800">{error ?? '링크를 열지 못했어요.'}</p>
      <p className="text-sm text-gray-500">위키 주인에게 새 링크를 받아 보세요.</p>
      <Link to="/" className="rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white">
        홈으로
      </Link>
    </div>
  )
}
