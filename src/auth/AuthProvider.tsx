import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { AuthContext } from './AuthContext'

async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[프로필 불러오기 실패]', error)
  return data ?? null
}

/** 앱 전체에 로그인 상태를 알려 주는 상자. main.tsx 에서 앱을 감쌉니다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  // 어느 사용자의 프로필인지 같이 기억 (계정이 바뀌면 예전 프로필을 쓰지 않도록)
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null)

  const userId = session?.user.id ?? null

  // 1) 로그인 상태 확인 + 변화 감지 (로그인/로그아웃/토큰 갱신)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 2) 로그인한 사용자가 바뀌면 프로필 불러오기
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchProfile(userId).then((profile) => {
      if (!cancelled) setLoaded({ userId, profile })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const profile = await fetchProfile(userId)
    setLoaded({ userId, profile })
  }, [userId])

  const profile = loaded && loaded.userId === userId ? loaded.profile : null
  const profileLoading = userId !== null && loaded?.userId !== userId

  const value = useMemo(
    () => ({
      loading: sessionLoading,
      profileLoading,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
    }),
    [sessionLoading, profileLoading, session, profile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
