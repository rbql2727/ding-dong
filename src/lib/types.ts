/** DB 테이블과 같은 모양의 타입들 (필요할 때마다 추가) */

export type Visibility = 'private' | 'link' | 'approved' | 'public'

export type Profile = {
  id: string
  nickname: string
  avatar_url: string | null
}
