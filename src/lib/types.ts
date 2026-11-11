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
