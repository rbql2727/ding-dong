import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { listMyWikis, type WikiWithCount } from '../../data/wikis'
import { BookIcon, PlusIcon } from '../../components/icons'
import { EmptyState, ErrorScreen, InlineLoading, PageHeader } from '../../components/ui'
import { themeStyle } from '../../lib/theme'
import { useLoad } from '../../lib/useLoad'
import { MediaImg } from '../../components/MediaImg'
import { COVER_ASPECT } from '../../lib/storage'

export function MyWikisPage() {
  const { user } = useAuth()
  const { data: wikis, loading, error, reload } = useLoad(() => listMyWikis(user!.id), [user?.id])

  return (
    <>
      <PageHeader
        title="내 위키"
        right={
          <Link
            to="/wikis/new"
            className="px-winbtn h-8 gap-1 pr-3 pl-2 text-sm font-bold"
          >
            <PlusIcon className="size-5" />새 위키
          </Link>
        }
      />

      {loading && <InlineLoading />}
      {error && <ErrorScreen message={error} onRetry={reload} />}

      {wikis && wikis.length === 0 && (
        <div>
          <EmptyState
            icon={<BookIcon className="size-8" />}
            title="아직 만든 위키가 없어요"
            description="첫 번째 위키를 만들고 캐릭터를 정리해 보세요."
          />
          <div className="px-4">
            <Link
              to="/wikis/new"
              className="flex h-12 items-center justify-center rounded-xl bg-indigo-500 font-semibold text-white"
            >
              위키 만들기
            </Link>
          </div>
        </div>
      )}

      {wikis && wikis.length > 0 && (
        <ul className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:px-6 lg:py-6 xl:grid-cols-3">
          {wikis.map((w) => (
            <li key={w.id}>
              <WikiCard wiki={w} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function WikiCard({ wiki }: { wiki: WikiWithCount }) {
  return (
    <Link
      to={`/w/${wiki.id}`}
      style={themeStyle(wiki.theme_color)}
      className="px-window block overflow-hidden active:translate-x-0.5 active:translate-y-0.5"
    >
      <div className="px-titlebar flex h-8 items-center px-2.5 text-sm">
        <span className="truncate">{wiki.name}.wiki</span>
      </div>
      <div style={{ aspectRatio: COVER_ASPECT }} className="relative border-b-3 border-ink bg-(--wiki)">
        {wiki.cover_url && (
          <MediaImg src={wiki.cover_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        )}
      </div>
      <div className="flex items-start gap-3 p-4">
        <span className="mt-1 size-3 shrink-0 border-2 border-ink bg-(--wiki)" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">{wiki.name}</p>
          {wiki.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{wiki.description}</p>}
          <p className="mt-2 text-xs text-gray-400">캐릭터 {wiki.characterCount}명</p>
        </div>
      </div>
    </Link>
  )
}
