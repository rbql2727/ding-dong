import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { listFriendships, searchProfiles } from '../../data/friends'
import { EXPLORE_PAGE_SIZE, exploreWikis } from '../../data/sharing'
import { ExploreCard } from '../../components/ExploreCard'
import { MyFriendCode, PersonRow } from '../../components/FriendBits'
import { CompassIcon, UserIcon } from '../../components/icons'
import { EmptyState, ErrorScreen, InlineLoading, PageHeader, Spinner } from '../../components/ui'
import { useLoad } from '../../lib/useLoad'

type Mode = 'wikis' | 'accounts'

/**
 * 탐색
 *  - 위키: 전체 공개 + 승인제(제목·표지만) + 친구 공개 위키. 위키 제목·캐릭터 이름으로 검색
 *  - 계정: 닉네임·고유코드로 검색 → 프로필. 검색어가 없으면 내 고유코드와 친구 목록
 */
export function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('tab') === 'accounts' ? 'accounts' : 'wikis'
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInput(value: string) {
    setInput(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => setQuery(value.trim()), 300)
  }

  function switchMode(next: Mode) {
    if (next === mode) return
    setParams(next === 'accounts' ? { tab: 'accounts' } : {}, { replace: true })
    setInput('')
    setQuery('')
  }

  return (
    <>
      <PageHeader title="탐색" />
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-[5] space-y-2 bg-paper px-4 pt-3 pb-2 lg:px-6 lg:pt-5">
        <div role="tablist" aria-label="검색 대상" className="grid grid-cols-2 gap-2">
          {(
            [
              ['wikis', '위키'],
              ['accounts', '계정'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => switchMode(value)}
              className={`px-btn h-10 text-sm font-bold ${mode === value ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={mode === 'wikis' ? '위키 제목 또는 캐릭터 이름' : '닉네임 또는 고유코드'}
          aria-label={mode === 'wikis' ? '위키 검색' : '계정 검색'}
          autoCapitalize="off"
          className="px-input h-11 w-full px-4 text-base"
        />
      </div>

      {mode === 'wikis' ? <WikiResults query={query} /> : <AccountResults query={query} />}
    </>
  )
}

function WikiResults({ query }: { query: string }) {
  const { data, loading, error, reload, setData } = useLoad(() => exploreWikis(query, 0), [query])
  const [more, setMore] = useState<{ key: string; loading: boolean; done: boolean }>({ key: '', loading: false, done: false })
  const moreState = more.key === query ? more : { loading: false, done: false }

  async function loadMore() {
    if (!data) return
    setMore({ key: query, loading: true, done: false })
    try {
      const next = await exploreWikis(query, data.length)
      setData((d) => [...d, ...next.filter((n) => !d.some((x) => x.id === n.id))])
      setMore({ key: query, loading: false, done: next.length < EXPLORE_PAGE_SIZE })
    } catch {
      setMore({ key: query, loading: false, done: false })
    }
  }

  const canLoadMore = !!data && data.length >= EXPLORE_PAGE_SIZE && !moreState.done

  return (
    <>
      {loading && <InlineLoading />}
      {error && <ErrorScreen message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<CompassIcon className="size-8" />}
          title={query ? '검색 결과가 없어요' : '아직 공개된 위키가 없어요'}
          description={query ? '볼 수 있는 위키의 제목과 캐릭터 이름에서 찾아요.' : '다른 사람이 위키를 공개하면 여기에 나타나요.'}
        />
      )}
      {data && data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 px-4 py-2 lg:grid-cols-2 lg:px-6">
          {data.map((w) => (
            <li key={w.id}>
              <ExploreCard wiki={w} />
            </li>
          ))}
        </ul>
      )}
      {canLoadMore && (
        <div className="px-4 pb-6 lg:px-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={moreState.loading}
            className="px-btn flex h-11 w-full items-center justify-center bg-paper text-sm font-bold text-ink"
          >
            {moreState.loading ? <Spinner className="size-4" /> : '더 보기'}
          </button>
        </div>
      )}
    </>
  )
}

function AccountResults({ query }: { query: string }) {
  const { user, profile } = useAuth()
  const search = useLoad(() => (query ? searchProfiles(query) : Promise.resolve(null)), [query])
  const friends = useLoad(() => listFriendships(user!.id), [user?.id])

  // 검색어가 없을 때: 내 고유코드 + 친구 목록
  if (!query) {
    return (
      <div className="space-y-4 px-4 py-3 lg:mx-auto lg:max-w-2xl lg:px-6">
        <MyFriendCode code={profile?.friend_code} />
        <section>
          <h2 className="mb-1 font-bold">친구</h2>
          {friends.loading && <InlineLoading />}
          {friends.error && <ErrorScreen message={friends.error} onRetry={friends.reload} />}
          {friends.data && friends.data.friends.length === 0 && (
            <p className="py-4 text-sm text-gray-500">
              아직 친구가 없어요. 친구의 고유코드나 닉네임을 검색해서 친구 신청을 보내 보세요.
            </p>
          )}
          {friends.data && friends.data.friends.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {friends.data.friends.map((f) => (
                <PersonRow key={f.friendship.id} profile={f.profile} />
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="px-4 py-2 lg:mx-auto lg:max-w-2xl lg:px-6">
      {search.loading && <InlineLoading />}
      {search.error && <ErrorScreen message={search.error} onRetry={search.reload} />}
      {search.data && search.data.length === 0 && (
        <EmptyState
          icon={<UserIcon className="size-8" />}
          title="찾는 계정이 없어요"
          description="고유코드는 8자리를 정확히, 닉네임은 일부만 입력해도 돼요."
        />
      )}
      {search.data && search.data.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {search.data.map((p) => (
            <PersonRow key={p.id} profile={p} status={p.friend_status} />
          ))}
        </ul>
      )}
    </div>
  )
}
