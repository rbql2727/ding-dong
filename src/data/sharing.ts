import { PUBLIC_SITE_URL, supabase } from '../lib/supabase'
import type { AccessRequest, ExploreWiki, Profile, RequestStatus, WikiPreview } from '../lib/types'
import { check } from './db'

/**
 * 공개·공유·열람 요청 관련 기능
 * (권한 판단은 모두 DB 의 RLS 정책과 함수가 함. 여기서는 부르기만)
 */

/** 위키 겉모습 (권한 없으면 null — 비공개이거나 링크로 안 들어온 경우) */
export async function getWikiPreview(wikiId: string): Promise<WikiPreview | null> {
  const rows = check(
    await supabase.rpc('get_wiki_preview', { p_wiki_id: wikiId }),
    '위키를 불러오지 못했어요.',
  ) as WikiPreview[]
  return rows[0] ?? null
}

export const EXPLORE_PAGE_SIZE = 20

/**
 * 탐색: 전체 공개 + 승인제(승인 전에는 제목·표지만) + 볼 수 있는 친구 공개 위키
 * 검색어는 위키 제목·캐릭터 이름(볼 수 있는 것만)·소개(볼 수 있는 위키만)에서 찾음.
 * ownerId 를 주면 그 사람의 위키만 (프로필 화면).
 */
export async function exploreWikis(query: string, offset = 0, ownerId?: string, limit = EXPLORE_PAGE_SIZE): Promise<ExploreWiki[]> {
  return check(
    await supabase.rpc('explore_wikis', {
      p_query: query,
      p_limit: limit,
      p_offset: offset,
      ...(ownerId ? { p_owner: ownerId } : {}),
    }),
    '위키 목록을 불러오지 못했어요.',
  ) as ExploreWiki[]
}

// ---------------------------------------------------------------------
// 공유 링크
// ---------------------------------------------------------------------

export function shareUrl(token: string) {
  return `${PUBLIC_SITE_URL}/s/${token}`
}

/** 공유 토큰 (주인만 받을 수 있음) */
export async function getShareToken(wikiId: string): Promise<string | null> {
  return check(await supabase.rpc('get_share_token', { p_wiki_id: wikiId }), '공유 링크를 불러오지 못했어요.') as
    | string
    | null
}

/** 링크 새로 만들기 → 예전 링크로 들어온 사람은 모두 다시 못 봄 */
export async function regenerateShareToken(wikiId: string): Promise<string> {
  return check(
    await supabase.rpc('regenerate_share_token', { p_wiki_id: wikiId }),
    '공유 링크를 새로 만들지 못했어요.',
  ) as string
}

/** 공유 링크로 들어오기 → 위키 id */
export async function redeemShareToken(token: string): Promise<string> {
  const res = await supabase.rpc('redeem_share_token', { p_token: token })
  if (res.error) {
    console.error('[공유 링크]', res.error)
    // DB 함수가 보낸 한국어 안내를 그대로 보여 줌
    throw new Error(/[가-힣]/.test(res.error.message) ? res.error.message : '링크를 열지 못했어요.')
  }
  return res.data as string
}

// ---------------------------------------------------------------------
// 열람 요청 (보내는 쪽)
// ---------------------------------------------------------------------

/** 열람 요청 보내기. 이미 보냈으면(중복) 조용히 넘어감 */
export async function requestAccess(wikiId: string, userId: string) {
  const res = await supabase.from('access_requests').insert({ wiki_id: wikiId, requester_id: userId })
  if (res.error?.code === '23505') return // 중복 요청 (DB 의 unique 규칙이 막음)
  check(res, '열람 요청을 보내지 못했어요.')
}

/** 내 요청 취소 (거절된 요청을 지우고 다시 요청할 때도 사용) */
export async function cancelAccessRequest(wikiId: string, userId: string) {
  check(
    await supabase.from('access_requests').delete().eq('wiki_id', wikiId).eq('requester_id', userId),
    '요청을 취소하지 못했어요.',
  )
}

/** 다시 요청 (거절·철회된 뒤) */
export async function requestAgain(wikiId: string, userId: string) {
  await cancelAccessRequest(wikiId, userId)
  await requestAccess(wikiId, userId)
}

export type MyRequest = {
  id: string
  wiki_id: string
  wiki_name: string
  cover_url: string | null
  theme_color: string
  owner_nickname: string
  status: RequestStatus
  created_at: string
}

export async function listMyRequests(): Promise<MyRequest[]> {
  return check(await supabase.rpc('my_access_requests'), '보낸 요청을 불러오지 못했어요.') as MyRequest[]
}

// ---------------------------------------------------------------------
// 열람 요청 (받는 쪽 = 위키 주인)
// ---------------------------------------------------------------------

export type RequestWithProfile = AccessRequest & { requester: Profile | null }

async function attachProfiles(requests: AccessRequest[]): Promise<RequestWithProfile[]> {
  if (requests.length === 0) return []
  const ids = [...new Set(requests.map((r) => r.requester_id))]
  const profiles = check(
    await supabase.from('profiles').select('id, nickname, avatar_url').in('id', ids),
    '요청한 사람 정보를 불러오지 못했어요.',
  ) as Profile[]
  return requests.map((r) => ({ ...r, requester: profiles.find((p) => p.id === r.requester_id) ?? null }))
}

/** 한 위키에 들어온 요청 전부 (최근 순) */
export async function listWikiRequests(wikiId: string): Promise<RequestWithProfile[]> {
  const rows = check(
    await supabase
      .from('access_requests')
      .select('id, wiki_id, requester_id, status, created_at')
      .eq('wiki_id', wikiId)
      .order('created_at', { ascending: false }),
    '요청 목록을 불러오지 못했어요.',
  ) as AccessRequest[]
  return attachProfiles(rows)
}

/** 내 위키들에 들어온 대기 중 요청 (알림 화면) */
export async function listReceivedPending(wikiIds: string[]): Promise<RequestWithProfile[]> {
  if (wikiIds.length === 0) return []
  const rows = check(
    await supabase
      .from('access_requests')
      .select('id, wiki_id, requester_id, status, created_at')
      .in('wiki_id', wikiIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    '받은 요청을 불러오지 못했어요.',
  ) as AccessRequest[]
  return attachProfiles(rows)
}

export async function countPendingRequests(wikiId: string): Promise<number> {
  const res = await supabase
    .from('access_requests')
    .select('id', { count: 'exact', head: true })
    .eq('wiki_id', wikiId)
    .eq('status', 'pending')
  check(res, '요청 수를 불러오지 못했어요.')
  return res.count ?? 0
}

/** 승인 / 거절 / 철회(= rejected) — DB 정책상 위키 주인만 가능 */
export async function setRequestStatus(requestId: string, status: RequestStatus) {
  const res = await supabase.from('access_requests').update({ status }).eq('id', requestId).select('id')
  const rows = check(res, '요청 상태를 바꾸지 못했어요.') as { id: string }[]
  if (rows.length === 0) throw new Error('요청 상태를 바꿀 권한이 없어요.')
}
