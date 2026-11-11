/** DB 테이블과 같은 모양의 타입들 (필요할 때마다 추가) */

export type Visibility = 'private' | 'link' | 'approved' | 'public'

export type Profile = {
  id: string
  nickname: string
  avatar_url: string | null
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
  name: string
  description: string | null
  cover_url: string | null
  theme_color: string
  visibility: Visibility
  owner_nickname: string
  character_count: number | null
  can_view: boolean
  my_request_status: RequestStatus | null
  created_at: string
}

export type AccessRequest = {
  id: string
  wiki_id: string
  requester_id: string
  status: RequestStatus
  created_at: string
}
