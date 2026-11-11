import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { signUpWithEmail } from '../../auth/authApi'
import { SocialLoginButtons } from '../../auth/SocialLoginButtons'
import { Button, ErrorText, TextField } from '../../components/ui'
import { AuthShell } from './AuthShell'

export function SignupPage() {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState('') // 인증 메일을 보낸 주소

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const name = nickname.trim()
    if (name.length < 1 || name.length > 30) return setError('닉네임은 1~30자로 입력해 주세요.')
    if (password.length < 6) return setError('비밀번호는 6자 이상으로 입력해 주세요.')
    if (password !== passwordConfirm) return setError('비밀번호가 서로 달라요.')

    setSubmitting(true)
    try {
      const { needsEmailConfirm } = await signUpWithEmail(email.trim(), password, name)
      // 인증이 필요 없으면 바로 로그인 상태가 되어 PublicOnlyRoute 가 홈으로 보냄
      if (needsEmailConfirm) setSentTo(email.trim())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="메일함을 확인해 주세요" subtitle={`${sentTo} 으로 인증 메일을 보냈어요.`}>
        <p className="text-sm leading-relaxed text-gray-600">
          메일 안의 링크를 누르면 가입이 완료돼요. 메일이 안 보이면 스팸함도 확인해 주세요.
        </p>
        <Link
          to="/login"
          className="mt-8 flex h-12 items-center justify-center rounded-xl bg-indigo-500 font-semibold text-white"
        >
          로그인 화면으로
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="회원가입" subtitle="나만의 캐릭터 위키를 시작해 보세요.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="닉네임"
          autoComplete="nickname"
          required
          maxLength={30}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="다른 사람에게 보이는 이름"
        />
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6자 이상"
        />
        <TextField
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="한 번 더 입력"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={submitting} className="mt-2">
          가입하기
        </Button>
      </form>

      <SocialLoginButtons />

      <p className="mt-8 text-center text-sm text-gray-500">
        이미 계정이 있나요?{' '}
        <Link to="/login" className="font-semibold text-indigo-500">
          로그인
        </Link>
      </p>
    </AuthShell>
  )
}
