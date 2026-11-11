import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { BackIcon } from './icons'
import { MediaImg } from './MediaImg'

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
      className={`px-spinner ${className}`}
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
    primary: 'bg-accent text-paper',
    secondary: 'bg-paper text-ink',
    danger: 'bg-paper text-red-600',
    dangerSolid: 'bg-red-600 text-paper',
    // 위키 테마 색 (위키 화면에서 --wiki 변수를 정해 둠)
    theme: 'bg-(--wiki) text-paper',
  }[variant]
  return (
    <button
      disabled={disabled || loading}
      className={`px-btn flex h-12 w-full items-center justify-center gap-2 font-bold ${styles} ${className}`}
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
      <span className="mb-1.5 block text-sm font-bold text-ink">
        <span className="text-accent">* </span>
        {label}
      </span>
      <input
        id={inputId}
        className={`px-input h-12 w-full px-4 text-base ${className}`}
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="border-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}

/** 화면 위쪽 제목 줄 — 레트로 창 제목 줄 모양 (스크롤해도 붙어 있음) */
export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="px-titlebar sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <h1 className="truncate font-title text-xl">{title}</h1>
        {right ?? <WindowDots />}
      </div>
    </header>
  )
}

/** 꾸밈용 창 버튼 (_ □ ×) */
function WindowDots() {
  return (
    <div aria-hidden className="flex gap-1">
      {['_', '□', '×'].map((c) => (
        <span key={c} className="px-winbtn pointer-events-none size-7 min-w-7 text-sm leading-none">
          {c}
        </span>
      ))}
    </div>
  )
}

/** 아직 내용이 없을 때 보여 주는 안내 */
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex size-16 items-center justify-center border-3 border-ink bg-paper text-accent shadow-md">
        {icon}
      </div>
      <p className="font-bold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  )
}

/** 프로필 사진 (없으면 닉네임 첫 글자) */
export function Avatar({ url, name, className = 'size-10 text-base' }: { url?: string | null; name?: string; className?: string }) {
  if (url) {
    return <MediaImg src={url} alt="" loading="lazy" className={`shrink-0 border-2 border-ink bg-gray-100 object-cover ${className}`} />
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center border-2 border-ink bg-accent font-bold text-paper ${className}`}
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
    <header className="px-titlebar sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2 px-3">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="px-winbtn shrink-0">
          <BackIcon className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-title text-lg">{title}</h1>
        <div className="flex shrink-0 items-center gap-1.5">{right}</div>
      </div>
    </header>
  )
}

/** 아이콘 버튼 (제목 줄 안에서는 창 버튼 모양) */
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
      className={`px-iconbtn flex size-10 items-center justify-center text-gray-600 active:bg-gray-100 disabled:opacity-30 ${className}`}
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
      className={`px-input field-sizing-content min-h-24 w-full resize-none px-4 py-3 text-base leading-relaxed ${className}`}
      {...rest}
    />
  )
  if (!label) return field
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">
        <span className="text-accent">* </span>
        {label}
      </span>
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
        <button type="button" onClick={onRetry} className="px-btn bg-paper px-4 py-2 text-sm font-bold">
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

/** 섹션 이름표 — 남색 상자 + 주황 그림자 */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`px-label text-base ${className}`}>{children}</h2>
}
