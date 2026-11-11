import type { AuthError, Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * 로그인 관련 기능 모음 (Supabase Auth)
 * 화면 코드에서는 supabase.auth 를 직접 부르지 말고 여기 함수를 쓰세요.
 */

/** 로그인/인증 메일 링크를 누른 뒤 돌아올 주소 */
function redirectUrl() {
  return window.location.origin
}

export async function signUpWithEmail(email: string, password: string, nickname: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // DB 트리거(handle_new_user)가 이 nickname 으로 profiles 행을 만듭니다.
      data: { nickname },
      emailRedirectTo: redirectUrl(),
    },
  })
  if (error) throw new Error(toKoreanAuthError(error))

  // 이메일 인증이 켜져 있으면 이미 가입된 이메일도 "성공"처럼 돌아옵니다 (identities 가 빈 배열).
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.')
  }

  // session 이 없으면 → 이메일 인증이 필요한 상태
  return { needsEmailConfirm: !data.session }
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(toKoreanAuthError(error))
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(toKoreanAuthError(error))
}

// ---------------------------------------------------------------------
// 소셜 로그인 (나중에 추가)
//
// 추가하는 방법:
//   1) Supabase 대시보드 → Authentication → Sign In / Providers 에서 Google 등을 켭니다.
//   2) 아래 SOCIAL_PROVIDERS 배열에 { id: 'google', label: 'Google로 계속하기' } 처럼 추가합니다.
//   → 로그인/회원가입 화면에 버튼이 자동으로 나타납니다.
// ---------------------------------------------------------------------
export type SocialProvider = { id: Provider; label: string }

export const SOCIAL_PROVIDERS: SocialProvider[] = [
  // { id: 'google', label: 'Google로 계속하기' },
  // { id: 'kakao', label: '카카오로 계속하기' },
]

export async function signInWithProvider(provider: Provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectUrl() },
  })
  if (error) throw new Error(toKoreanAuthError(error))
}

// ---------------------------------------------------------------------
// 오류 메시지를 한국어로
// ---------------------------------------------------------------------
export function toKoreanAuthError(error: AuthError | Error): string {
  const code = 'code' in error ? (error.code as string | undefined) : undefined
  const msg = error.message ?? ''

  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials'))
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed'))
    return '이메일 인증이 아직 안 됐어요. 메일함에서 인증 링크를 눌러 주세요.'
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return '이미 가입된 이메일입니다. 로그인해 주세요.'
  if (code === 'weak_password' || msg.includes('Password should be'))
    return '비밀번호가 너무 짧거나 쉬워요. 6자 이상으로 입력해 주세요.'
  if (code === 'email_address_invalid' || msg.includes('invalid format'))
    return '이메일 형식이 올바르지 않습니다.'
  if (code?.includes('rate_limit') || msg.toLowerCase().includes('rate limit'))
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.'
  return '문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
}
