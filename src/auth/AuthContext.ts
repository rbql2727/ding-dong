import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../lib/types'

export type AuthContextValue = {
  /** 처음 로그인 상태를 확인하는 중이면 true (이때만 화면 전체 로딩) */
  loading: boolean
  /** 프로필을 불러오는 중이면 true (화면은 먼저 보여 주고 프로필은 나중에 채움) */
  profileLoading: boolean
  session: Session | null
  user: User | null
  /** 내 프로필 (profiles 테이블). 로그인 안 했으면 null */
  profile: Profile | null
  /** 프로필을 DB에서 다시 불러오기 (닉네임/사진 변경 후) */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** 어느 화면에서든 로그인 정보를 꺼내 쓰는 함수 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.')
  return value
}
