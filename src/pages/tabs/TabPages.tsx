import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { BookIcon } from '../../components/icons'
import { Avatar, EmptyState, PageHeader } from '../../components/ui'

/** 하단 탭 화면들 (2단계: 뼈대만. 내용은 다음 단계에서 채움) */

export function HomePage() {
  const { profile } = useAuth()
  return (
    <>
      <PageHeader title="홈" />
      <section className="px-4 pt-5 lg:px-6 lg:pt-6">
        <Link
          to="/profile"
          className="px-window flex items-center gap-3 p-5"
        >
          <Avatar url={profile?.avatar_url} name={profile?.nickname} className="size-12 text-lg shadow-sm" />
          <div className="min-w-0">
            <p className="text-sm text-dim">반가워요</p>
            <p className="truncate text-lg font-bold">{profile?.nickname ?? '사용자'}님</p>
          </div>
        </Link>
      </section>
      <EmptyState
        icon={<BookIcon className="size-8" />}
        title="아직 보여 줄 소식이 없어요"
        description="위키를 만들면 최근 소식이 여기에 나타나요."
      />
    </>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-black text-indigo-200">404</p>
      <p className="font-semibold text-gray-800">페이지를 찾을 수 없어요</p>
      <Link to="/" className="rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white">
        홈으로
      </Link>
    </div>
  )
}
