import type { ReactNode } from 'react'

/** 로그인·회원가입 화면 공통 틀 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[calc(3rem+env(safe-area-inset-top))] pb-10">
      <div className="px-window">
        <div className="px-titlebar flex h-11 items-center justify-between pr-2 pl-3">
          <span className="font-title text-base">OC_WIKI.exe</span>
          <span aria-hidden className="flex gap-1">
            {['_', '□', '×'].map((c) => (
              <span key={c} className="px-winbtn pointer-events-none size-7 min-w-7 text-sm leading-none">
                {c}
              </span>
            ))}
          </span>
        </div>
        <div className="px-5 pt-6 pb-8">
      <div className="mb-8">
        <div className="mb-6 flex size-14 items-center justify-center border-3 border-ink bg-accent font-title text-2xl text-paper shadow-md">
          OC
        </div>
        <h1 className="font-title text-2xl text-gray-900">{title}</h1>
        {subtitle && <p className="mt-2 text-gray-500">{subtitle}</p>}
      </div>
      {children}
        </div>
      </div>
    </div>
  )
}
