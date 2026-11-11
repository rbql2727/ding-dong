import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  acceptFriendRequest,
  getUserProfile,
  removeFriendship,
  sendFriendRequest,
  type UserProfile,
} from '../../data/friends'
import { exploreWikis } from '../../data/sharing'
import { ExploreCard } from '../../components/ExploreCard'
import { FriendStatusBadge } from '../../components/FriendBits'
import { ConfirmModal } from '../../components/Modal'
import { Avatar, BackHeader, Button, ErrorScreen, ErrorText, InlineLoading } from '../../components/ui'
import { useLoad } from '../../lib/useLoad'

/** 다른 사람 프로필: 닉네임·고유코드, 친구 신청/수락/끊기, 볼 수 있는 위키 */
export function UserProfilePage() {
  const { userId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload, setData } = useLoad(() => getUserProfile(user!.id, userId), [user?.id, userId])
  const wikis = useLoad(() => exploreWikis('', 0, userId, 50), [userId, data?.status])

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/explore?tab=accounts'))

  return (
    <div className="pb-10">
      <BackHeader title={data?.profile.nickname ?? '프로필'} onBack={back} />
      {loading && <InlineLoading />}
      {error && <ErrorScreen message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6 px-4 pt-6 lg:mx-auto lg:max-w-2xl lg:px-8 lg:pt-10">
          <section className="flex flex-col items-center gap-2 text-center">
            <Avatar url={data.profile.avatar_url} name={data.profile.nickname} className="size-24 text-3xl" />
            <div className="flex items-center gap-2">
              <h2 className="font-title text-xl">{data.profile.nickname}</h2>
              <FriendStatusBadge status={data.status} />
            </div>
            {data.profile.friend_code && <p className="font-mono text-sm text-gray-500">#{data.profile.friend_code}</p>}
          </section>

          <FriendActions data={data} onChanged={reload} setData={setData} />

          <section>
            <h3 className="mb-2 font-bold">위키</h3>
            {wikis.loading && <InlineLoading />}
            {wikis.error && <ErrorScreen message={wikis.error} onRetry={wikis.reload} />}
            {wikis.data && wikis.data.length === 0 && (
              <p className="py-4 text-sm text-gray-500">
                {data.status === 'friends' || data.status === 'me'
                  ? '보여 줄 위키가 없어요.'
                  : '볼 수 있는 위키가 없어요. 친구가 되면 친구 공개 위키를 볼 수 있어요.'}
              </p>
            )}
            {wikis.data && wikis.data.length > 0 && (
              <ul className="grid grid-cols-1 gap-3">
                {wikis.data.map((w) => (
                  <li key={w.id}>
                    <ExploreCard wiki={w} showOwner={false} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function FriendActions({
  data,
  onChanged,
  setData,
}: {
  data: UserProfile
  onChanged: () => void
  setData: (updater: (prev: UserProfile) => UserProfile) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'unfriend' | null>(null)
  const { status, friendship, profile } = data

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'me') {
    return (
      <Link to="/profile" className="px-btn flex h-12 items-center justify-center bg-paper font-bold text-ink">
        내 프로필 수정
      </Link>
    )
  }

  return (
    <section className="space-y-2">
      {status === 'none' && (
        <Button
          loading={busy}
          onClick={() =>
            run(async () => {
              const result = await sendFriendRequest(profile.id)
              setData((d) => ({ ...d, status: result }))
            })
          }
        >
          친구 신청
        </Button>
      )}
      {status === 'sent' && (
        <>
          <p className="text-center text-sm text-gray-500">친구 신청을 보냈어요. 상대가 수락하면 친구가 돼요.</p>
          <Button variant="secondary" loading={busy} onClick={() => friendship && run(() => removeFriendship(friendship.id))}>
            신청 취소
          </Button>
        </>
      )}
      {status === 'received' && (
        <>
          <p className="text-center text-sm text-gray-500">{profile.nickname}님이 친구 신청을 보냈어요.</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => friendship && run(() => removeFriendship(friendship.id))}>
              거절
            </Button>
            <Button loading={busy} onClick={() => friendship && run(() => acceptFriendRequest(friendship.id))}>
              수락
            </Button>
          </div>
        </>
      )}
      {status === 'friends' && (
        <Button variant="danger" disabled={busy} onClick={() => setConfirm('unfriend')}>
          친구 끊기
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
      <ConfirmModal
        open={confirm === 'unfriend'}
        title="친구를 끊을까요?"
        message={`${profile.nickname}님과 서로의 친구 공개 위키를 더 이상 볼 수 없어요.`}
        confirmText="끊기"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!friendship) return
          await removeFriendship(friendship.id)
          onChanged()
        }}
      />
    </section>
  )
}
