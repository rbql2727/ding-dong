import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { signInWithEmail } from '../../auth/authApi'
import { SocialLoginButtons } from '../../auth/SocialLoginButtons'
import { Button, ErrorText, TextField } from '../../components/ui'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signInWithEmail(email.trim(), password)
      // 로그인 성공 → PublicOnlyRoute 가 자동으로 원래 화면(또는 홈)으로 보냄
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="다시 만나서 반가워요" subtitle="내 캐릭터 위키에 로그인하세요.">
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
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={submitting} className="mt-2">
          로그인
        </Button>
      </form>

      <SocialLoginButtons />

      <p className="mt-8 text-center text-sm text-gray-500">
        아직 계정이 없나요?{' '}
        <Link to="/signup" className="font-semibold text-indigo-500">
          회원가입
        </Link>
      </p>
    </AuthShell>
  )
}
