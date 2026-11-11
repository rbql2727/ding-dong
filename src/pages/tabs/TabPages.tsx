import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { BellIcon, BookIcon, CompassIcon } from '../../components/icons'
import { Avatar, EmptyState, PageHeader } from '../../components/ui'

/** 하단 탭 화면들 (2단계: 뼈대만. 내용은 다음 단계에서 채움) */

export function HomePage() {
  const { profile } = useAuth()
  return (
    <>
      <PageHeader title="홈" />
      <section className="px-4 pt-5">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white shadow-lg shadow-indigo-100"
        >
          <Avatar url={profile?.avatar_url} name={profile?.nickname} className="size-12 text-lg ring-2 ring-white/60" />
          <div className="min-w-0">
            <p className="text-sm text-white/80">반가워요</p>
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

export function ExplorePage() {
  return (
    <>
      <PageHeader title="탐색" />
      <EmptyState
        icon={<CompassIcon className="size-8" />}
        title="탐색 기능을 준비하고 있어요"
        description="전체 공개된 다른 사람들의 위키를 여기서 둘러볼 수 있게 될 거예요."
      />
    </>
  )
}

export function NotificationsPage() {
  return (
    <>
      <PageHeader title="알림" />
      <EmptyState
        icon={<BellIcon className="size-8" />}
        title="새 알림이 없어요"
        description="열람 요청이 오거나 승인되면 여기서 알려 드릴게요."
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
