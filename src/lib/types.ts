/** DB 테이블과 같은 모양의 타입들 (필요할 때마다 추가) */

export type Visibility = 'private' | 'link' | 'friends' | 'approved' | 'public'

export type Profile = {
  id: string
  nickname: string
  avatar_url: string | null
  /** 고유코드 (친구 찾기용 8자리). 다른 사람 목록에서는 없을 수 있음 */
  friend_code?: string
}

export type Wiki = {
  id: string
  owner_id: string
  name: string
  description: string
  cover_url: string | null
  theme_color: string
  visibility: Visibility
  created_at: string
}

export type Room = {
  id: string
  wiki_id: string
  name: string
  sort_order: number
}

export type Character = {
  id: string
  wiki_id: string
  room_id: string | null
  name: string
  tagline: string
  cover_image_id: string | null
  visibility: Visibility
  sort_order: number
  created_at: string
}

export type CharacterField = {
  id: string
  character_id: string
  label: string
  content: string
  sort_order: number
}

export type CharacterImage = {
  id: string
  character_id: string
  image_url: string
  thumb_url: string
  sort_order: number
}

export type CharacterLog = {
  id: string
  character_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export type RequestStatus = 'pending' | 'approved' | 'rejected'

/** get_wiki_preview(): 권한이 없어도 볼 수 있는 위키 겉모습 */
export type WikiPreview = {
  id: string
  name: string
  /** 볼 권한이 없으면 null */
  description: string | null
  cover_url: string | null
  theme_color: string
  visibility: Visibility
  owner_id: string
  owner_nickname: string
  can_view: boolean
  my_request_status: RequestStatus | null
}

/** explore_wikis(): 탐색 목록 */
export type ExploreWiki = {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_url: string | null
  theme_color: string
  visibility: Visibility
  owner_nickname: string
  character_count: number | null
  can_view: boolean
  my_request_status: RequestStatus | null
  /** 검색어와 이름이 맞는 캐릭터 (볼 수 있는 것만, 최대 5) */
  matched_characters: string[]
  created_at: string
}

export type AccessRequest = {
  id: string
  wiki_id: string
  requester_id: string
  status: RequestStatus
  created_at: string
}

/** 나와의 관계: 나 / 친구 / 내가 신청함 / 신청 받음 / 없음 */
export type FriendStatus = 'me' | 'friends' | 'sent' | 'received' | 'none'

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
  accepted_at: string | null
}

/** 계정 검색 결과 */
export type ProfileSearchResult = {
  id: string
  nickname: string
  avatar_url: string | null
  friend_code: string
  friend_status: FriendStatus
}

/** 홈 소식 (최근 로그) */
export type FeedItem = {
  log_id: string
  title: string
  created_at: string
  character_id: string
  character_name: string
  thumb_url: string | null
  wiki_id: string
  wiki_name: string
  theme_color: string
  owner_id: string
  owner_nickname: string
  owner_avatar_url: string | null
}
