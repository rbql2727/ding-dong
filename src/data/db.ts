import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Supabase 응답을 확인해서, 오류면 한국어 메시지로 던지고 아니면 데이터를 돌려줍니다.
 * (자세한 오류는 개발자 도구 콘솔에 남김)
 */
export function check<T>(res: { data: T | null; error: PostgrestError | null }, message: string): T {
  if (res.error) {
    console.error(`[${message}]`, res.error)
    throw new Error(message)
  }
  return res.data as T
}

/** 데이터가 없을 때 (권한이 없거나 지워진 경우 포함) */
export class NotFoundError extends Error {}
