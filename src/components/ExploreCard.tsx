import { Link } from 'react-router-dom'
import { MediaImg } from './MediaImg'
import { themeStyle } from '../lib/theme'
import type { ExploreWiki } from '../lib/types'

/** 탐색·프로필 화면의 위키 카드 (승인 전 위키는 잠금 표시) */
export function ExploreCard({ wiki, showOwner = true }: { wiki: ExploreWiki; showOwner?: boolean }) {
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
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 truncate font-bold text-gray-900">{wiki.name}</p>
          {locked && <span aria-label="잠김">🔒</span>}
          {wiki.visibility === 'friends' && <span className="shrink-0 bg-accent px-1 text-[10px] text-paper">친구</span>}
        </div>
        {showOwner && <p className="truncate text-xs text-gray-500">{wiki.owner_nickname}</p>}
        {locked ? (
          <p className="mt-1.5 inline-block bg-ink px-2 py-0.5 text-xs text-paper">{statusText}</p>
        ) : (
          <>
            {wiki.matched_characters?.length > 0 && (
              <p className="mt-1 truncate text-xs text-accent">캐릭터: {wiki.matched_characters.join(', ')}</p>
            )}
            {wiki.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{wiki.description}</p>}
            {wiki.character_count !== null && <p className="mt-1 text-xs text-gray-400">캐릭터 {wiki.character_count}명</p>}
          </>
        )}
      </div>
    </Link>
  )
}
