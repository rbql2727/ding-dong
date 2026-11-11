import type { ReactNode } from 'react'

/** 로그인·회원가입 화면 공통 틀 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(4rem+env(safe-area-inset-top))] pb-10">
      <div className="mb-10">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-indigo-500 text-2xl font-black text-white shadow-lg shadow-indigo-200">
          OC
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-2 text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
