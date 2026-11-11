import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 연결 모듈
 *
 * - 키는 .env 파일에서 읽습니다 (VITE_ 로 시작해야 브라우저 코드에서 읽을 수 있음).
 * - 여기 들어가는 anon(publishable) 키는 공개돼도 괜찮은 키입니다.
 *   실제 데이터 보호는 DB의 Row Level Security(RLS) 정책이 담당합니다.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 프로젝트 주소 (이미지 주소가 우리 Storage 것인지 확인할 때 사용) */
export const SUPABASE_URL = (supabaseUrl ?? '').replace(/\/+$/, '')

/**
 * 공개 웹사이트 주소 (공유 링크·인증 메일 링크에 사용)
 * 안드로이드 앱 안에서는 주소가 https://localhost 라서 남에게 줄 수 없으므로,
 * 웹을 배포한 주소를 .env 의 VITE_PUBLIC_SITE_URL 에 넣어 두세요. 없으면 지금 주소를 씀.
 */
export const PUBLIC_SITE_URL = ((import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || window.location.origin).replace(
  /\/+$/,
  '',
)

/** .env 에 키가 제대로 들어 있는지 여부 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] .env 에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 넣어 주세요. (.env.example 참고)',
  )
}

/** 앱 전체에서 쓰는 기본 클라이언트 (로그인 상태 유지) */
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/** 이미지 등 파일을 올리는 Storage 버킷 이름 (supabase/migrations 의 SQL과 같아야 함) */
export const MEDIA_BUCKET = 'media'
