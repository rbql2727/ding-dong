import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { listCharacters, type CharacterCard } from '../../data/characters'
import { createRoom, deleteRoom, listRooms, renameRoom, saveRoomOrder } from '../../data/rooms'
import { countPendingRequests, getWikiPreview } from '../../data/sharing'
import { getWiki } from '../../data/wikis'
import { ActionSheet, ConfirmModal, PromptModal } from '../../components/Modal'
import { BackIcon, GearIcon, MoreIcon, PlusIcon, UserIcon } from '../../components/icons'
import { ErrorScreen, IconButton, InlineLoading } from '../../components/ui'
import { themeStyle } from '../../lib/theme'
import type { Room, Visibility, WikiPreview } from '../../lib/types'
import { visibilityLabel } from '../../lib/visibility'
import { useLoad } from '../../lib/useLoad'
import { MediaImg } from '../../components/MediaImg'
import { LockedWikiView } from './LockedWikiView'

async function loadWikiHome(wikiId: string, isOwner: boolean) {
  const [wiki, rooms, characters, pendingCount] = await Promise.all([
    getWiki(wikiId),
    listRooms(wikiId),
    listCharacters(wikiId),
    isOwner ? countPendingRequests(wikiId) : Promise.resolve(0),
  ])
  return { wiki, rooms, characters, pendingCount }
}

type RoomDialog =
  | { type: 'add' }
  | { type: 'menu'; room: Room }
  | { type: 'rename'; room: Room }
  | { type: 'delete'; room: Room }
  | null

/**
 * 위키 홈 (/w/:wikiId)
 * 먼저 "겉모습(미리보기)"만 물어보고, 볼 권한이 있으면 내용을, 없으면 잠긴 화면(열람 요청)을 보여 줌.
 */
export function WikiHomePage() {
  const { wikiId = '' } = useParams()
  const navigate = useNavigate()
  const { data: preview, loading, error, reload } = useLoad(() => getWikiPreview(wikiId), [wikiId])

  if (loading) return <InlineLoading />
  if (error || !preview) {
    return (
      <>
        <TopBar onBack={() => navigate(-1)} />
        <ErrorScreen
          message={error ?? '위키를 찾을 수 없어요. 비공개이거나, 링크로만 볼 수 있는 위키예요.'}
          onRetry={error ? reload : undefined}
        />
      </>
    )
  }
  if (!preview.can_view) return <LockedWikiView preview={preview} onChanged={reload} />
  return <WikiContent wikiId={wikiId} preview={preview} />
}

function WikiContent({ wikiId, preview }: { wikiId: string; preview: WikiPreview }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwnerByPreview = preview.owner_id === user?.id
  const { data, loading, error, reload, setData } = useLoad(
    () => loadWikiHome(wikiId, isOwnerByPreview),
    [wikiId, isOwnerByPreview],
  )
  const backTo = isOwnerByPreview ? '/wikis' : '/explore'
  const [dialog, setDialog] = useState<RoomDialog>(null)
  const [orderError, setOrderError] = useState('')

  if (loading) return <InlineLoading />
  if (error || !data) {
    return (
      <>
        <TopBar onBack={() => navigate(backTo)} />
        <ErrorScreen message={error ?? '위키를 찾을 수 없어요.'} onRetry={reload} />
      </>
    )
  }

  const { wiki, rooms, characters, pendingCount } = data
  const isOwner = wiki.owner_id === user?.id
  const unassigned = characters.filter((c) => !c.room_id || !rooms.some((r) => r.id === c.room_id))

  async function moveRoom(room: Room, delta: -1 | 1) {
    const index = rooms.findIndex((r) => r.id === room.id)
    const target = index + delta
    if (target < 0 || target >= rooms.length) return
    const next = [...rooms]
    ;[next[index], next[target]] = [next[target], next[index]]
    setData((d) => ({ ...d, rooms: next })) // 화면 먼저 바꾸고
    setOrderError('')
    try {
      await saveRoomOrder(next) // 서버에 저장
      setData((d) => ({ ...d, rooms: next.map((r, i) => ({ ...r, sort_order: i })) }))
    } catch (err) {
      setOrderError((err as Error).message)
      reload()
    }
  }

  return (
    <div style={themeStyle(wiki.theme_color)} className="pb-24">
      {/* 표지 + 제목 */}
      <section className="relative">
        <div className="relative h-44 border-b-3 border-ink bg-(--wiki)">
          {wiki.cover_url && <MediaImg src={wiki.cover_url} alt="" decoding="async" className="size-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/10" />
        </div>
        <TopBar
          overlay
          onBack={() => navigate(backTo)}
          right={
            isOwner && (
              <IconButton label="위키 설정" onClick={() => navigate(`/w/${wiki.id}/settings`)} className="px-winbtn size-9 min-w-9">
                <GearIcon />
              </IconButton>
            )
          }
        />
        <div className="px-4 pt-4">
          <h1 className="font-title text-2xl break-words text-gray-900">{wiki.name}</h1>
          {wiki.description && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-gray-600">{wiki.description}</p>}
          <p className="mt-2 text-xs text-gray-400">
            {!isOwner && <>{preview.owner_nickname} · </>}캐릭터 {characters.length}명 · 방 {rooms.length}개
          </p>
          {isOwner && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/w/${wiki.id}/settings`}
                className="px-btn bg-paper px-3 py-1.5 text-xs font-bold text-ink"
              >
                공개 범위: {visibilityLabel(wiki.visibility)}
              </Link>
              {(wiki.visibility === 'approved' || pendingCount > 0) && (
                <Link
                  to={`/w/${wiki.id}/access`}
                  className="px-btn bg-(--wiki) px-3 py-1.5 text-xs font-bold text-paper"
                >
                  열람 승인 관리{pendingCount > 0 && ` · 대기 ${pendingCount}`}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {orderError && <p className="mx-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{orderError}</p>}

      {/* 방별 캐릭터 */}
      <div className="mt-6 space-y-8">
        {rooms.map((room) => (
          <RoomSection
            key={room.id}
            title={room.name}
            wikiId={wiki.id}
            roomId={room.id}
            characters={characters.filter((c) => c.room_id === room.id)}
            isOwner={isOwner}
            wikiVisibility={wiki.visibility}
            onMenu={isOwner ? () => setDialog({ type: 'menu', room }) : undefined}
          />
        ))}

        {(unassigned.length > 0 || rooms.length === 0) && (
          <RoomSection
            title={rooms.length === 0 ? '캐릭터' : '분류 없음'}
            wikiId={wiki.id}
            roomId={null}
            characters={unassigned}
            isOwner={isOwner}
            wikiVisibility={wiki.visibility}
          />
        )}
      </div>

      {isOwner && (
        <div className="mt-8 px-4">
          <button
            type="button"
            onClick={() => setDialog({ type: 'add' })}
            className="flex h-12 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 font-medium text-gray-600 active:bg-gray-50"
          >
            <PlusIcon className="size-5" />방 추가
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">방으로 캐릭터를 묶어 정리할 수 있어요 (예: 1부, 주인공들, 악역)</p>
        </div>
      )}

      {/* 방 관련 창들 */}
      <PromptModal
        open={dialog?.type === 'add'}
        title="방 추가"
        label="방 이름"
        placeholder="예: 주인공들"
        submitText="추가"
        onSubmit={async (name) => {
          const room = await createRoom(wiki.id, name, rooms.length)
          setData((d) => ({ ...d, rooms: [...d.rooms, room] }))
        }}
        onClose={() => setDialog(null)}
      />

      {dialog?.type === 'menu' && (
        <ActionSheet
          open
          title={dialog.room.name}
          onClose={() => setDialog(null)}
          actions={[
            { label: '이름 바꾸기', onClick: () => setDialog({ type: 'rename', room: dialog.room }) },
            { label: '위로 옮기기', onClick: () => moveRoom(dialog.room, -1), disabled: rooms[0]?.id === dialog.room.id },
            { label: '아래로 옮기기', onClick: () => moveRoom(dialog.room, 1), disabled: rooms.at(-1)?.id === dialog.room.id },
            { label: '방 삭제', onClick: () => setDialog({ type: 'delete', room: dialog.room }), danger: true },
          ]}
        />
      )}

      <PromptModal
        open={dialog?.type === 'rename'}
        title="방 이름 바꾸기"
        label="방 이름"
        initialValue={dialog?.type === 'rename' ? dialog.room.name : ''}
        onSubmit={async (name) => {
          if (dialog?.type !== 'rename') return
          const id = dialog.room.id
          await renameRoom(id, name)
          setData((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, name } : r)) }))
        }}
        onClose={() => setDialog(null)}
      />

      <ConfirmModal
        open={dialog?.type === 'delete'}
        title="방을 삭제할까요?"
        message="방 안의 캐릭터는 지워지지 않고 '분류 없음'으로 옮겨져요."
        confirmText="삭제"
        danger
        onConfirm={async () => {
          if (dialog?.type !== 'delete') return
          const id = dialog.room.id
          await deleteRoom(id)
          setData((d) => ({
            ...d,
            rooms: d.rooms.filter((r) => r.id !== id),
            characters: d.characters.map((c) => (c.room_id === id ? { ...c, room_id: null } : c)),
          }))
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

function TopBar({ onBack, right, overlay = false }: { onBack: () => void; right?: ReactNode; overlay?: boolean }) {
  return (
    <div
      className={`${overlay ? 'absolute inset-x-0 top-0 text-white' : 'text-gray-700'} flex items-center justify-between px-2 pt-[calc(0.5rem+env(safe-area-inset-top))]`}
    >
      <IconButton label="뒤로 가기" onClick={onBack} className={overlay ? 'px-winbtn size-9 min-w-9' : ''}>
        <BackIcon />
      </IconButton>
      {right}
    </div>
  )
}

function RoomSection({
  title,
  wikiId,
  roomId,
  characters,
  isOwner,
  onMenu,
  wikiVisibility,
}: {
  title: string
  wikiId: string
  roomId: string | null
  characters: CharacterCard[]
  isOwner: boolean
  onMenu?: () => void
  wikiVisibility: Visibility
}) {
  const newLink = `/w/${wikiId}/c/new${roomId ? `?room=${roomId}` : ''}`
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-4">
        <h2 className="px-label min-w-0 truncate text-base">{title}</h2>
        <span className="ml-1 flex-1 text-sm text-accent italic">{characters.length}</span>
        {onMenu && (
          <IconButton label={`${title} 방 메뉴`} onClick={onMenu} className="-mr-2">
            <MoreIcon className="size-5" />
          </IconButton>
        )}
      </div>

      {characters.length === 0 && !isOwner ? (
        <p className="px-4 text-sm text-gray-400">아직 캐릭터가 없어요.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4 min-[480px]:grid-cols-3">
          {characters.map((c) => (
            <li key={c.id}>
              <Link to={`/w/${wikiId}/c/${c.id}`} className="block active:opacity-80">
                <div className="relative aspect-[3/4] overflow-hidden border-3 border-ink bg-gray-100 shadow-sm">
                  {/* 주인에게만: 위키와 다른 공개 범위인 캐릭터 표시 */}
                  {isOwner && c.visibility !== wikiVisibility && (
                    <span className="absolute top-1.5 left-1.5 z-[1] bg-ink px-2 py-0.5 text-[11px] text-paper">
                      {visibilityLabel(c.visibility)}
                    </span>
                  )}
                  {c.thumbUrl ? (
                    <MediaImg src={c.thumbUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-gray-300">
                      <UserIcon className="size-12" />
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate font-semibold text-gray-900">{c.name}</p>
                {c.tagline && <p className="truncate text-xs text-gray-500">{c.tagline}</p>}
              </Link>
            </li>
          ))}
          {isOwner && (
            <li>
              <Link
                to={newLink}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 active:bg-gray-50"
              >
                <PlusIcon className="size-7" />
                캐릭터 추가
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
