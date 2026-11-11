import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { changePassword, sendPasswordResetEmail, updatePassword } from '../../auth/authApi'
import { Button, ErrorText, FullScreenLoading, TextField } from '../../components/ui'
import { AuthShell } from './AuthShell'

/** 새 비밀번호 검사 (회원가입과 같은 기준: 6자 이상) */
function checkNewPassword(password: string, confirm: string): string {
  if (password.length < 6) return '새 비밀번호는 6자 이상으로 입력해 주세요.'
  if (password !== confirm) return '새 비밀번호가 서로 달라요.'
  return ''
}

/** 새 비밀번호 + 확인 입력칸 */
function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
}: {
  password: string
  confirm: string
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
}) {
  return (
    <>
      <TextField
        label="새 비밀번호"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        placeholder="6자 이상"
      />
      <TextField
        label="새 비밀번호 확인"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => onConfirm(e.target.value)}
        placeholder="한 번 더 입력"
      />
    </>
  )
}

// ---------------------------------------------------------------------
// 프로필 화면 안: 비밀번호 바꾸기 (로그인한 상태)
// ---------------------------------------------------------------------
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user?.email) return
    setError('')
    const problem = checkNewPassword(password, confirm)
    if (problem) return setError(problem)
    if (password === current) return setError('지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요.')
    setSaving(true)
    try {
      await changePassword(user.email, current, password)
      setCurrent('')
      setPassword('')
      setConfirm('')
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextField
        label="지금 비밀번호"
        type="password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" loading={saving}>
        비밀번호 바꾸기
      </Button>
      <p className="text-xs text-gray-400">
        지금 비밀번호가 기억나지 않으면 로그아웃한 뒤 로그인 화면의 “비밀번호를 잊었어요”를 눌러 주세요.
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------
// /forgot-password : 재설정 메일 보내기 (로그인 안 한 상태)
// ---------------------------------------------------------------------
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await sendPasswordResetEmail(email.trim())
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="메일을 보냈어요" subtitle={`${email.trim()} 메일함을 확인해 주세요.`}>
        <div className="space-y-3 text-sm leading-relaxed text-gray-600">
          <p>메일 속 링크를 누르면 새 비밀번호를 정하는 화면이 열려요.</p>
          <p className="text-gray-400">
            메일이 안 보이면 스팸함도 확인해 주세요. 가입하지 않은 이메일이면 메일이 가지 않아요.
          </p>
        </div>
        <Link to="/login" className="mt-8 block text-center text-sm font-semibold text-indigo-500">
          로그인 화면으로
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="비밀번호 재설정" subtitle="가입한 이메일로 재설정 링크를 보내 드려요.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="이메일"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={sending} className="mt-2">
          재설정 메일 보내기
        </Button>
      </form>
      <Link to="/login" className="mt-8 block py-2 text-center text-sm font-semibold text-indigo-500">
        로그인 화면으로
      </Link>
    </AuthShell>
  )
}

// ---------------------------------------------------------------------
// /reset-password : 메일 링크로 들어와서 새 비밀번호 정하기
// (링크를 누르면 Supabase 가 잠깐 로그인시켜 줌 → 그 상태에서 비밀번호 변경)
// ---------------------------------------------------------------------
function linkErrorInUrl(): boolean {
  const all = window.location.search + '&' + window.location.hash.replace(/^#/, '')
  return /(^|[?&])error(_code)?=/.test(all)
}

export function ResetPasswordPage() {
  const { loading, session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) return <FullScreenLoading />

  if (done) {
    return (
      <AuthShell title="비밀번호를 바꿨어요" subtitle="다음부터 새 비밀번호로 로그인하세요.">
        <Button onClick={() => navigate('/', { replace: true })}>홈으로</Button>
      </AuthShell>
    )
  }

  if (!session || linkErrorInUrl()) {
    return (
      <AuthShell title="링크를 쓸 수 없어요" subtitle="링크가 만료됐거나 이미 사용됐어요.">
        <p className="text-sm text-gray-600">재설정 메일을 다시 받아 주세요. (링크는 한 번만, 1시간 안에 쓸 수 있어요)</p>
        <Link to="/forgot-password" className="mt-8 block py-2 text-center text-sm font-semibold text-indigo-500">
          재설정 메일 다시 받기
        </Link>
      </AuthShell>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const problem = checkNewPassword(password, confirm)
    if (problem) return setError(problem)
    setSaving(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthShell title="새 비밀번호 정하기" subtitle={session.user.email ?? undefined}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={saving} className="mt-2">
          비밀번호 바꾸기
        </Button>
      </form>
    </AuthShell>
  )
}
