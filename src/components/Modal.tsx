import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button, ErrorText, TextField } from './ui'

/** 화면 아래에서 올라오는 창 (폰에서 쓰기 편하게) */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
        {title && <h2 className="mb-4 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/** 글자 하나 입력받는 창 (방 이름 등) */
export function PromptModal({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  maxLength = 50,
  submitText = '저장',
  onSubmit,
  onClose,
}: {
  open: boolean
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  maxLength?: number
  submitText?: string
  onSubmit: (value: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {/* key 로 열 때마다 입력칸을 새로 만듦 */}
      {open && (
        <PromptForm
          key={initialValue}
          label={label}
          initialValue={initialValue}
          placeholder={placeholder}
          maxLength={maxLength}
          submitText={submitText}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function PromptForm(props: {
  label: string
  initialValue: string
  placeholder?: string
  maxLength: number
  submitText: string
  onSubmit: (value: string) => Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState(props.initialValue)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (!v) return setError('내용을 입력해 주세요.')
    setBusy(true)
    setError('')
    try {
      await props.onSubmit(v)
      props.onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label={props.label}
        autoFocus
        value={value}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={props.onClose}>
          취소
        </Button>
        <Button type="submit" loading={busy}>
          {props.submitText}
        </Button>
      </div>
    </form>
  )
}

/** "정말 할까요?" 확인 창 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmText = '확인',
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message?: ReactNode
  confirmText?: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      {message && <div className="mb-5 text-sm leading-relaxed text-gray-600">{message}</div>}
      <ErrorText>{error}</ErrorText>
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button type="button" variant={danger ? 'dangerSolid' : 'primary'} onClick={handleConfirm} loading={busy}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}

/** 아래에서 올라오는 메뉴 (⋯ 버튼) */
export function ActionSheet({
  open,
  title,
  actions,
  onClose,
}: {
  open: boolean
  title?: string
  actions: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[]
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <ul className="-mx-2">
        {actions.map((a) => (
          <li key={a.label}>
            <button
              type="button"
              disabled={a.disabled}
              onClick={() => {
                onClose()
                a.onClick()
              }}
              className={`w-full rounded-xl px-3 py-3.5 text-left font-medium active:bg-gray-50 disabled:text-gray-300 ${
                a.danger ? 'text-red-600' : 'text-gray-800'
              }`}
            >
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
