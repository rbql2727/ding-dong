import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { acceptFriendRequest, listFriendships, removeFriendship, type FriendEntry } from '../../data/friends'
import { PersonRow } from '../../components/FriendBits'
import { listMyRequests, listReceivedPending, type MyRequest, type RequestWithProfile } from '../../data/sharing'
import { listMyWikis } from '../../data/wikis'
import { MediaImg } from '../../components/MediaImg'
import { BellIcon } from '../../components/icons'
import { Avatar, EmptyState, ErrorScreen, InlineLoading, PageHeader } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { themeStyle } from '../../lib/theme'
import { useLoad } from '../../lib/useLoad'

async function load(userId: string) {
  const wikis = await listMyWikis(userId)
  const [received, mine, friends] = await Promise.all([
    listReceivedPending(wikis.map((w) => w.id)),
    listMyRequests(),
    listFriendships(userId),
  ])
  const wikiName = new Map(wikis.map((w) => [w.id, w.name]))
  return {
    received: received.map((r) => ({ ...r, wikiName: wikiName.get(r.wiki_id) ?? '' })),
    mine,
    friendRequests: friends.received,
  }
}

/** 알림: 받은 친구 신청 + 내 위키에 온 열람 요청 + 내가 보낸 요청 상태 */
export function NotificationsPage() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useLoad(() => load(user!.id), [user?.id])

  return (
    <>
      <PageHeader title="알림" />
      {loading && <InlineLoading />}
      {error && <ErrorScreen message={error} onRetry={reload} />}
      {data && data.received.length === 0 && data.mine.length === 0 && data.friendRequests.length === 0 && (
        <EmptyState
          icon={<BellIcon className="size-8" />}
          title="새 알림이 없어요"
          description="친구 신청이나 열람 요청이 오거나, 내가 보낸 요청이 승인되면 여기서 볼 수 있어요."
        />
      )}
      {data && data.friendRequests.length > 0 && (
        <section className="px-4 pt-4 lg:mx-auto lg:max-w-2xl lg:px-8 lg:pt-6">
          <h2 className="mb-1 font-bold">받은 친구 신청</h2>
          <ul className="divide-y divide-gray-100">
            {data.friendRequests.map((f) => (
              <FriendRequestRow key={f.friendship.id} entry={f} onDone={reload} />
            ))}
          </ul>
        </section>
      )}
      {data && data.received.length > 0 && (
        <section className="px-4 pt-4 lg:mx-auto lg:max-w-2xl lg:px-8 lg:pt-6">
          <h2 className="mb-1 font-bold">받은 열람 요청</h2>
          <ul className="divide-y divide-gray-100">
            {data.received.map((r) => (
              <ReceivedRow key={r.id} req={r} />
            ))}
          </ul>
        </section>
      )}
      {data && data.mine.length > 0 && (
        <section className="px-4 pt-6 pb-6 lg:mx-auto lg:max-w-2xl lg:px-8">
          <h2 className="mb-1 font-bold">보낸 열람 요청</h2>
          <ul className="divide-y divide-gray-100">
            {data.mine.map((r) => (
              <MineRow key={r.id} req={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function ReceivedRow({ req }: { req: RequestWithProfile & { wikiName: string } }) {
  return (
    <li>
      <Link to={`/w/${req.wiki_id}/access`} className="flex items-center gap-3 py-3 active:bg-gray-50">
        <Avatar url={req.requester?.avatar_url} name={req.requester?.nickname} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-800">
            <b>{req.requester?.nickname ?? '누군가'}</b>님이 <b>{req.wikiName}</b> 열람을 요청했어요.
          </p>
          <p className="text-xs text-gray-400">{formatDate(req.created_at)}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-indigo-500">확인</span>
      </Link>
    </li>
  )
}

const STATUS_TEXT = { pending: '승인 대기 중', approved: '승인됨', rejected: '거절·철회됨' } as const
const STATUS_STYLE = {
  pending: 'bg-gray-100 text-gray-600',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
} as const

function MineRow({ req }: { req: MyRequest }) {
  return (
    <li>
      <Link to={`/w/${req.wiki_id}`} style={themeStyle(req.theme_color)} className="flex items-center gap-3 py-3 active:bg-gray-50">
        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-(--wiki)">
          {req.cover_url && <MediaImg src={req.cover_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{req.wiki_name}</p>
          <p className="text-xs text-gray-400">
            {req.owner_nickname} · {formatDate(req.created_at)}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[req.status]}`}>{STATUS_TEXT[req.status]}</span>
      </Link>
    </li>
  )
}

function FriendRequestRow({ entry, onDone }: { entry: FriendEntry; onDone: () => void }) {
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState('')
  async function run(kind: 'accept' | 'reject') {
    setBusy(kind)
    setError('')
    try {
      if (kind === 'accept') await acceptFriendRequest(entry.friendship.id)
      else await removeFriendship(entry.friendship.id)
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }
  return (
    <>
      <PersonRow
        profile={entry.profile}
        right={
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('reject')}
              className="px-btn h-9 bg-paper px-3 text-sm font-bold text-ink"
            >
              거절
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('accept')}
              className="px-btn h-9 bg-accent px-3 text-sm font-bold text-paper"
            >
              {busy === 'accept' ? '…' : '수락'}
            </button>
          </div>
        }
      />
      {error && <li className="pb-2 text-xs text-red-600">{error}</li>}
    </>
  )
}
