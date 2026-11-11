import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { BackIcon } from './icons'

/** 여러 화면에서 같이 쓰는 기본 UI 조각들 */

export function FullScreenLoading({ text = '불러오는 중…' }: { text?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-gray-500">
      <Spinner />
      <p className="text-sm">{text}</p>
    </div>
  )
}

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerSolid' | 'theme'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const styles = {
    primary: 'bg-indigo-500 text-white active:bg-indigo-600 disabled:bg-indigo-300',
    secondary: 'border border-gray-200 bg-white text-gray-800 active:bg-gray-50 disabled:text-gray-400',
    danger: 'border border-red-200 bg-white text-red-600 active:bg-red-50 disabled:text-red-300',
    dangerSolid: 'bg-red-500 text-white active:bg-red-600 disabled:bg-red-300',
    // 위키 테마 색 (위키 화면에서 --wiki 변수를 정해 둠)
    theme: 'bg-(--wiki) text-white active:brightness-95 disabled:opacity-50',
  }[variant]
  return (
    <button
      disabled={disabled || loading}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-colors ${styles} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function TextField({ label, hint, id, className = '', ...rest }: TextFieldProps) {
  const inputId = id ?? `f-${label}`
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      <input
        id={inputId}
        className={`h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${className}`}
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
      {children}
    </p>
  )
}

/** 화면 위쪽 제목 줄 (스크롤해도 붙어 있음) */
export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-bold">{title}</h1>
        {right}
      </div>
    </header>
  )
}

/** 아직 내용이 없을 때 보여 주는 안내 */
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
        {icon}
      </div>
      <p className="font-semibold text-gray-800">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  )
}

/** 프로필 사진 (없으면 닉네임 첫 글자) */
export function Avatar({ url, name, className = 'size-10 text-base' }: { url?: string | null; name?: string; className?: string }) {
  if (url) {
    return <img src={url} alt="" loading="lazy" className={`shrink-0 rounded-full bg-gray-100 object-cover ${className}`} />
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-500 ${className}`}
    >
      {(name ?? '?').trim().charAt(0) || '?'}
    </span>
  )
}

/** 하위 화면 위쪽: 뒤로 가기 + 제목 + 오른쪽 버튼 */
export function BackHeader({
  title,
  onBack,
  right,
}: {
  title?: string
  onBack: () => void
  right?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
        >
          <BackIcon />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold">{title}</h1>
        <div className="flex shrink-0 items-center gap-1 pr-1">{right}</div>
      </div>
    </header>
  )
}

/** 동그란 아이콘 버튼 */
export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex size-10 items-center justify-center rounded-full text-gray-600 active:bg-gray-100 disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }

/** 여러 줄 입력칸 (내용에 맞춰 자동으로 늘어남) */
export function TextArea({ label, hint, id, className = '', ...rest }: TextAreaProps) {
  const field = (
    <textarea
      id={id}
      className={`field-sizing-content min-h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-base leading-relaxed outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${className}`}
      {...rest}
    />
  )
  if (!label) return field
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {field}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

/** 불러오기 실패 등 화면 전체 안내 */
export function ErrorScreen({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="text-gray-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium">
          다시 시도
        </button>
      )}
    </div>
  )
}

/** 화면 일부 로딩 */
export function InlineLoading() {
  return (
    <div className="flex justify-center py-20 text-gray-400">
      <Spinner />
    </div>
  )
}
