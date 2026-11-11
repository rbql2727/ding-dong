import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { countReceivedFriendRequests, FEED_PAGE_SIZE, homeFeed } from '../../data/friends'
import { MediaImg } from '../../components/MediaImg'
import { BookIcon } from '../../components/icons'
import { Avatar, EmptyState, ErrorScreen, InlineLoading, PageHeader, Spinner } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { themeStyle } from '../../lib/theme'
import type { FeedItem } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'

/** 홈: 인사 + 받은 친구 신청 + 최근 로그 (나와 친구의 위키, 내가 볼 수 있는 것만) */
export function HomePage() {
  const { user, profile } = useAuth()
  const feed = useLoad(() => homeFeed(), [user?.id])
  const requests = useLoad(() => countReceivedFriendRequests(user!.id), [user?.id])
  const [more, setMore] = useState({ loading: false, done: false })

  async function loadMore() {
    const last = feed.data?.at(-1)
    if (!last) return
    setMore({ loading: true, done: false })
    try {
      const next = await homeFeed(last.created_at)
      feed.setData((d) => [...d, ...next.filter((n) => !d.some((x) => x.log_id === n.log_id))])
      setMore({ loading: false, done: next.length < FEED_PAGE_SIZE })
    } catch {
      setMore({ loading: false, done: false })
    }
  }

  return (
    <>
      <PageHeader title="홈" />
      <section className="space-y-3 px-4 pt-5 lg:px-6 lg:pt-6">
        <Link to="/profile" className="px-window flex items-center gap-3 p-5">
          <Avatar url={profile?.avatar_url} name={profile?.nickname} className="size-12 text-lg shadow-sm" />
          <div className="min-w-0">
            <p className="text-sm text-dim">반가워요</p>
            <p className="truncate text-lg font-bold">{profile?.nickname ?? '사용자'}님</p>
          </div>
        </Link>
        {!!requests.data && (
          <Link to="/notifications" className="flex items-center justify-between bg-accent px-4 py-3 text-paper">
            <span className="font-bold">친구 신청 {requests.data}건이 와 있어요</span>
            <span className="text-sm">확인 ▶</span>
          </Link>
        )}
      </section>

      <section className="px-4 pt-6 pb-6 lg:px-6">
        <h2 className="mb-2 font-bold">최근 로그</h2>
        {feed.loading && <InlineLoading />}
        {feed.error && <ErrorScreen message={feed.error} onRetry={feed.reload} />}
        {feed.data && feed.data.length === 0 && (
          <EmptyState
            icon={<BookIcon className="size-8" />}
            title="아직 소식이 없어요"
            description="캐릭터 로그를 쓰거나, 탐색 → 계정에서 친구를 추가하면 여기에 최근 로그가 나타나요."
          />
        )}
        {feed.data && feed.data.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {feed.data.map((item) => (
              <li key={item.log_id}>
                <FeedCard item={item} mine={item.owner_id === user?.id} />
              </li>
            ))}
          </ul>
        )}
        {feed.data && feed.data.length >= FEED_PAGE_SIZE && !more.done && (
          <button
            type="button"
            onClick={loadMore}
            disabled={more.loading}
            className="px-btn mt-4 flex h-11 w-full items-center justify-center bg-paper text-sm font-bold text-ink"
          >
            {more.loading ? <Spinner className="size-4" /> : '더 보기'}
          </button>
        )}
      </section>
    </>
  )
}

function FeedCard({ item, mine }: { item: FeedItem; mine: boolean }) {
  return (
    <Link
      to={`/w/${item.wiki_id}/c/${item.character_id}/logs/${item.log_id}`}
      style={themeStyle(item.theme_color)}
      className="px-window flex gap-3 overflow-hidden p-3 active:translate-x-0.5 active:translate-y-0.5"
    >
      <div className="h-20 w-15 shrink-0 overflow-hidden border-2 border-ink bg-(--wiki)">
        {item.thumb_url && (
          <MediaImg src={item.thumb_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 font-bold text-gray-900">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-(--wiki)">
          {item.character_name} · {item.wiki_name}
        </p>
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
          {!mine && <Avatar url={item.owner_avatar_url} name={item.owner_nickname} className="size-5 text-[10px]" />}
          <span className="truncate">
            {mine ? '내 위키' : item.owner_nickname} · {formatDate(item.created_at)}
          </span>
        </div>
      </div>
    </Link>
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
