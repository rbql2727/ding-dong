import { useState } from 'react'
import { SOCIAL_PROVIDERS, signInWithProvider } from './authApi'

/** 소셜 로그인 버튼 묶음. authApi.ts 의 SOCIAL_PROVIDERS 가 비어 있으면 아무것도 안 보입니다. */
export function SocialLoginButtons() {
  const [error, setError] = useState('')

  if (SOCIAL_PROVIDERS.length === 0) return null

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        또는
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      {SOCIAL_PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => signInWithProvider(p.id).catch((e: Error) => setError(e.message))}
          className="h-12 w-full rounded-xl border border-gray-200 bg-white font-medium text-gray-800 active:bg-gray-50"
        >
          {p.label}
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
