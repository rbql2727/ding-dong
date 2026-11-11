import { supabase } from '../lib/supabase'
import type { FeedItem, FriendStatus, Friendship, Profile, ProfileSearchResult } from '../lib/types'
import { check, NotFoundError } from './db'

/**
 * 친구·계정 검색·홈 소식
 * (누가 무엇을 볼 수 있는지는 DB 정책과 함수가 판단. 여기서는 부르기만)
 */

const PROFILE_COLUMNS = 'id, nickname, avatar_url, friend_code'

/** 계정 검색: 고유코드(정확히) 또는 닉네임(일부) */
export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  return check(
    await supabase.rpc('search_profiles', { p_query: query, p_limit: 30 }),
    '계정을 찾지 못했어요.',
  ) as ProfileSearchResult[]
}

export type UserProfile = { profile: Profile; status: FriendStatus; friendship: Friendship | null }

/** 다른 사람 프로필 + 나와의 관계 */
export async function getUserProfile(myId: string, userId: string): Promise<UserProfile> {
  const [profileRes, friendRes] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    supabase
      .from('friendships')
      .select('*')
      .in('requester_id', [myId, userId])
      .in('addressee_id', [myId, userId])
      .maybeSingle(),
  ])
  const profile = check(profileRes, '프로필을 불러오지 못했어요.') as Profile | null
  if (!profile) throw new NotFoundError('사용자를 찾을 수 없어요.')
  const friendship = (myId === userId ? null : check(friendRes, '프로필을 불러오지 못했어요.')) as Friendship | null
  let status: FriendStatus = 'none'
  if (myId === userId) status = 'me'
  else if (friendship?.status === 'accepted') status = 'friends'
  else if (friendship) status = friendship.requester_id === myId ? 'sent' : 'received'
  return { profile, status, friendship }
}

/** 친구 신청 (상대가 이미 나에게 신청했다면 바로 친구가 됨) */
export async function sendFriendRequest(userId: string): Promise<'sent' | 'friends'> {
  return check(await supabase.rpc('send_friend_request', { p_user_id: userId }), '친구 신청을 하지 못했어요.') as
    | 'sent'
    | 'friends'
}

/** 받은 친구 신청 수락 */
export async function acceptFriendRequest(friendshipId: string) {
  check(
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId),
    '친구 신청을 수락하지 못했어요.',
  )
}

/** 거절 / 신청 취소 / 친구 끊기 (모두 관계 삭제) */
export async function removeFriendship(friendshipId: string) {
  check(await supabase.from('friendships').delete().eq('id', friendshipId), '처리하지 못했어요.')
}

export type FriendEntry = { friendship: Friendship; profile: Profile }

/** 내 친구 관계 목록 (친구 / 받은 신청 / 보낸 신청) */
export async function listFriendships(myId: string): Promise<{
  friends: FriendEntry[]
  received: FriendEntry[]
  sent: FriendEntry[]
}> {
  const rows = check(
    await supabase.from('friendships').select('*').order('created_at', { ascending: false }),
    '친구 목록을 불러오지 못했어요.',
  ) as Friendship[]
  const otherIds = [...new Set(rows.map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id)))]
  const profiles =
    otherIds.length === 0
      ? []
      : (check(
          await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', otherIds),
          '친구 목록을 불러오지 못했어요.',
        ) as Profile[])
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const entries = rows
    .map((f) => ({ friendship: f, profile: byId.get(f.requester_id === myId ? f.addressee_id : f.requester_id) }))
    .filter((e): e is FriendEntry => !!e.profile)
  return {
    friends: entries
      .filter((e) => e.friendship.status === 'accepted')
      .sort((a, b) => a.profile.nickname.localeCompare(b.profile.nickname, 'ko')),
    received: entries.filter((e) => e.friendship.status === 'pending' && e.friendship.addressee_id === myId),
    sent: entries.filter((e) => e.friendship.status === 'pending' && e.friendship.requester_id === myId),
  }
}

/** 받은 친구 신청 수 */
export async function countReceivedFriendRequests(myId: string): Promise<number> {
  const res = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('addressee_id', myId)
    .eq('status', 'pending')
  check(res, '친구 신청을 불러오지 못했어요.')
  return res.count ?? 0
}

export const FEED_PAGE_SIZE = 20

/** 홈 소식: 나와 친구의 위키에 올라온 최근 로그 (before 보다 오래된 것) */
export async function homeFeed(before?: string): Promise<FeedItem[]> {
  return check(
    await supabase.rpc('home_feed', { p_limit: FEED_PAGE_SIZE, ...(before ? { p_before: before } : {}) }),
    '소식을 불러오지 못했어요.',
  ) as FeedItem[]
}
