import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getCharacterFull, type CharacterFull } from '../../data/characters'
import { listLogs } from '../../data/logs'
import { listRooms } from '../../data/rooms'
import { getWiki } from '../../data/wikis'
import { ImageViewer } from '../../components/ImageViewer'
import { PencilIcon, PlusIcon, UserIcon } from '../../components/icons'
import { BackHeader, ErrorScreen, IconButton, InlineLoading } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { toPreview } from '../../lib/richText'
import { themeStyle } from '../../lib/theme'
import type { CharacterImage } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'
import { MediaImg } from '../../components/MediaImg'

async function loadDetail(wikiId: string, charId: string) {
  const [wiki, rooms, full] = await Promise.all([getWiki(wikiId), listRooms(wikiId), getCharacterFull(charId)])
  return { wiki, rooms, full }
}

type Tab = 'profile' | 'logs'

export function CharacterDetailPage() {
  const { wikiId = '', charId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useLoad(() => loadDetail(wikiId, charId), [wikiId, charId])
  const tab: Tab = searchParams.get('tab') === 'logs' ? 'logs' : 'profile'
  const back = () => navigate(`/w/${wikiId}`)

  if (loading) return <InlineLoading />
  if (error || !data) {
    return (
      <>
        <BackHeader title="캐릭터" onBack={back} />
        <ErrorScreen message={error ?? '캐릭터를 찾을 수 없어요.'} onRetry={reload} />
      </>
    )
  }

  const { wiki, rooms, full } = data
  const { character } = full
  const isOwner = wiki.owner_id === user?.id
  const room = rooms.find((r) => r.id === character.room_id)

  return (
    <div style={themeStyle(wiki.theme_color)} className="pb-16">
      <BackHeader
        title={wiki.name}
        onBack={back}
        right={
          isOwner && (
            <IconButton label="캐릭터 편집" onClick={() => navigate(`/w/${wikiId}/c/${charId}/edit`)}>
              <PencilIcon />
            </IconButton>
          )
        }
      />

      <Gallery key={charId} full={full} />

      <section className="px-4 pt-5">
        {room && (
          <span className="mb-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{room.name}</span>
        )}
        <h1 className="text-2xl font-bold break-words text-gray-900">{character.name}</h1>
        {character.tagline && <p className="mt-1 text-gray-600">{character.tagline}</p>}
      </section>

      {/* 탭 */}
      <div role="tablist" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-[5] mt-5 flex border-b border-gray-100 bg-white">
        {(
          [
            ['profile', '프로필'],
            ['logs', '로그'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setSearchParams(key === 'profile' ? {} : { tab: key }, { replace: true })}
            className={`flex-1 border-b-2 py-3 text-sm font-semibold transition-colors ${
              tab === key ? 'border-(--wiki) text-gray-900' : 'border-transparent text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <ProfileTab full={full} isOwner={isOwner} editLink={`/w/${wikiId}/c/${charId}/edit`} />
      ) : (
        <LogsTab wikiId={wikiId} charId={charId} isOwner={isOwner} />
      )}
    </div>
  )
}

/** 상세 화면 이미지: 여기서만 원본(1600px)을 불러옴. 아래 줄은 썸네일. */
function Gallery({ full }: { full: CharacterFull }) {
  const { images, character } = full
  const coverIndex = Math.max(0, images.findIndex((img) => img.id === character.cover_image_id))
  const [selected, setSelected] = useState(coverIndex)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-gray-50 text-gray-300">
        <UserIcon className="size-20" />
      </div>
    )
  }

  const current: CharacterImage = images[Math.min(selected, images.length - 1)]
  return (
    <section>
      <button
        type="button"
        onClick={() => setViewerIndex(selected)}
        aria-label="이미지 크게 보기"
        className="block w-full bg-gray-50"
      >
        <MediaImg
          key={current.id}
          src={current.image_url}
          alt=""
          decoding="async"
          className="mx-auto max-h-[60vh] min-h-48 w-full object-contain"
        />
      </button>

      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${i + 1}번째 이미지`}
                className={`block size-16 overflow-hidden rounded-lg bg-gray-100 ${i === selected ? 'ring-2 ring-(--wiki) ring-offset-1' : 'opacity-70'}`}
              >
                <MediaImg src={img.thumb_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewerIndex !== null && (
        <ImageViewer
          urls={images.map((img) => img.image_url)}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </section>
  )
}

function ProfileTab({ full, isOwner, editLink }: { full: CharacterFull; isOwner: boolean; editLink: string }) {
  if (full.fields.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-gray-500">아직 작성한 항목이 없어요.</p>
        {isOwner && (
          <Link to={editLink} className="mt-4 inline-block rounded-xl bg-(--wiki) px-5 py-3 text-sm font-semibold text-white">
            항목 추가하기
          </Link>
        )}
      </div>
    )
  }
  return (
    <dl className="divide-y divide-gray-100 px-4">
      {full.fields.map((f) => (
        <div key={f.id} className="py-4">
          <dt className="mb-1 text-sm font-bold text-(--wiki)">{f.label}</dt>
          <dd className="leading-relaxed break-words whitespace-pre-wrap text-gray-800">{f.content || <span className="text-gray-300">-</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

function LogsTab({ wikiId, charId, isOwner }: { wikiId: string; charId: string; isOwner: boolean }) {
  const { data: logs, loading, error, reload } = useLoad(() => listLogs(charId), [charId])
  const base = `/w/${wikiId}/c/${charId}/logs`

  return (
    <section className="px-4 pt-4">
      {isOwner && (
        <Link
          to={`${base}/new`}
          className="mb-4 flex h-11 items-center justify-center gap-1 rounded-xl bg-(--wiki) text-sm font-semibold text-white active:brightness-95"
        >
          <PlusIcon className="size-5" />
          로그 쓰기
        </Link>
      )}
      {loading && <InlineLoading />}
      {error && <ErrorScreen message={error} onRetry={reload} />}
      {logs && logs.length === 0 && <p className="py-12 text-center text-gray-400">아직 로그가 없어요.</p>}
      {logs && logs.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {logs.map((log) => {
            const preview = toPreview(log.body)
            return (
              <li key={log.id}>
                <Link to={`${base}/${log.id}`} className="block py-4 active:bg-gray-50">
                  <p className="truncate font-semibold text-gray-900">{log.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatDate(log.created_at)}</p>
                  {preview && <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{preview}</p>}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
