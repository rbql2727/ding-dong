import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from './ui'
import type { FriendStatus, Profile } from '../lib/types'

const STATUS_TEXT: Partial<Record<FriendStatus, string>> = {
  friends: '친구',
  sent: '신청함',
  received: '신청 받음',
}

/** 나와의 관계 작은 표시 (친구 / 신청함 / 신청 받음) */
export function FriendStatusBadge({ status }: { status: FriendStatus }) {
  const text = STATUS_TEXT[status]
  if (!text) return null
  const style = status === 'friends' ? 'bg-accent text-paper' : 'bg-ink text-paper'
  return <span className={`shrink-0 px-2 py-0.5 text-xs ${style}`}>{text}</span>
}

/** 사람 한 줄 (누르면 프로필) */
export function PersonRow({
  profile,
  status,
  right,
}: {
  profile: Pick<Profile, 'id' | 'nickname' | 'avatar_url' | 'friend_code'>
  status?: FriendStatus
  right?: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link to={`/u/${profile.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
        <Avatar url={profile.avatar_url} name={profile.nickname} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">{profile.nickname}</p>
          {profile.friend_code && <p className="font-mono text-xs text-gray-400">#{profile.friend_code}</p>}
        </div>
        {status && <FriendStatusBadge status={status} />}
      </Link>
      {right}
    </li>
  )
}

/** 내 고유코드 + 복사 버튼 */
export function MyFriendCode({ code }: { code?: string }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null
  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사가 안 되는 환경이면 직접 보고 적으면 됨 */
    }
  }
  return (
    <div className="px-window flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">내 고유코드 (친구에게 알려 주세요)</p>
        <p className="font-mono text-xl font-bold tracking-widest text-ink">#{code}</p>
      </div>
      <button type="button" onClick={copy} className="px-btn h-10 shrink-0 bg-paper px-3 text-sm font-bold text-ink">
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  )
}
