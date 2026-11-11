import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXPLORE_PAGE_SIZE, exploreWikis } from '../../data/sharing'
import { MediaImg } from '../../components/MediaImg'
import { CompassIcon } from '../../components/icons'
import { EmptyState, ErrorScreen, InlineLoading, PageHeader, Spinner } from '../../components/ui'
import { themeStyle } from '../../lib/theme'
import type { ExploreWiki } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'

/** 탐색: 전체 공개 위키 + 승인제 위키(제목·표지만) 목록과 검색 */
export function ExplorePage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data, loading, error, reload, setData } = useLoad(() => exploreWikis(query, 0), [query])
  const [more, setMore] = useState<{ loading: boolean; done: boolean }>({ loading: false, done: false })

  function handleInput(value: string) {
    setInput(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setQuery(value.trim())
      setMore({ loading: false, done: false })
    }, 300)
  }

  async function loadMore() {
    if (!data) return
    setMore({ loading: true, done: false })
    try {
      const next = await exploreWikis(query, data.length)
      setData((d) => [...d, ...next.filter((n) => !d.some((x) => x.id === n.id))])
      setMore({ loading: false, done: next.length < EXPLORE_PAGE_SIZE })
    } catch {
      setMore({ loading: false, done: false })
    }
  }

  const canLoadMore = !!data && data.length >= EXPLORE_PAGE_SIZE && !more.done

  return (
    <>
      <PageHeader title="탐색" />
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-[5] bg-paper px-4 pt-3 pb-2 lg:px-6 lg:pt-5">
        <input
          type="search"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="위키 이름으로 검색"
          aria-label="위키 검색"
          className="px-input h-11 w-full px-4 text-base"
        />
      </div>

      {loading && <InlineLoading />}
      {error && <ErrorScreen message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<CompassIcon className="size-8" />}
          title={query ? '검색 결과가 없어요' : '아직 공개된 위키가 없어요'}
          description={query ? '다른 이름으로 찾아보세요.' : '다른 사람이 위키를 공개하면 여기에 나타나요.'}
        />
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-3 px-4 py-2 lg:grid-cols-2 lg:px-6">
          {data.map((w) => (
            <li key={w.id}>
              <ExploreCard wiki={w} />
            </li>
          ))}
        </ul>
      )}
      {canLoadMore && (
        <div className="px-4 pb-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={more.loading}
            className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
          >
            {more.loading ? <Spinner className="size-4" /> : '더 보기'}
          </button>
        </div>
      )}
    </>
  )
}

function ExploreCard({ wiki }: { wiki: ExploreWiki }) {
  const locked = !wiki.can_view
  const statusText =
    wiki.my_request_status === 'pending' ? '승인 대기 중' : wiki.my_request_status === 'rejected' ? '거절됨' : '승인 필요'
  return (
    <Link
      to={`/w/${wiki.id}`}
      style={themeStyle(wiki.theme_color)}
      className="px-window flex gap-3 overflow-hidden p-3 active:translate-x-0.5 active:translate-y-0.5"
    >
      <div className="size-20 shrink-0 overflow-hidden border-2 border-ink bg-(--wiki)">
        {wiki.cover_url && <MediaImg src={wiki.cover_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-gray-900">{wiki.name}</p>
          {locked && <span aria-label="잠김">🔒</span>}
        </div>
        <p className="text-xs text-gray-500">{wiki.owner_nickname}</p>
        {locked ? (
          <p className="mt-1.5 inline-block bg-ink px-2 py-0.5 text-xs text-paper">{statusText}</p>
        ) : (
          <>
            {wiki.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{wiki.description}</p>}
            {wiki.character_count !== null && <p className="mt-1 text-xs text-gray-400">캐릭터 {wiki.character_count}명</p>}
          </>
        )}
      </div>
    </Link>
  )
}
