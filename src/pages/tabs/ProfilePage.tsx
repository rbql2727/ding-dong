import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { signOut } from '../../auth/authApi'
import { CameraIcon } from '../../components/icons'
import { Avatar, Button, ErrorText, PageHeader, Spinner, TextField } from '../../components/ui'
import { ImageCropModal } from '../../components/ImageCropModal'
import { ChangePasswordForm } from '../auth/PasswordPages'
import { MyFriendCode } from '../../components/FriendBits'
import { Link } from 'react-router-dom'
import { IMAGE_SIZE, mediaPaths, removeMediaByUrl, uploadBlob } from '../../lib/storage'
import { useCropPicker } from '../../lib/useCropPicker'
import { supabase } from '../../lib/supabase'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  // 입력 중인 닉네임 (null 이면 아직 안 고침 → 저장된 닉네임을 보여 줌)
  const [draftName, setDraftName] = useState<string | null>(null)
  const nickname = draftName ?? profile?.nickname ?? ''
  const [savingName, setSavingName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // 안내 문구는 잠깐만 보여 줌
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  // 사진 고르기 → 자르기 창 → 적용하면 업로드
  const cropper = useCropPicker(setError)

  if (!user) return null

  const trimmed = nickname.trim()
  const nameChanged = !!profile && trimmed !== profile.nickname

  async function handleSaveNickname(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    if (trimmed.length < 1 || trimmed.length > 30) return setError('닉네임은 1~30자로 입력해 주세요.')

    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ nickname: trimmed }).eq('id', user.id)
    setSavingName(false)
    if (error) return setError('닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    await refreshProfile()
    setDraftName(null)
    setNotice('닉네임을 바꿨어요.')
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 동작하게
    if (!file) return
    setError('')
    cropper.pick(file)
  }

  async function uploadCroppedAvatar(blob: Blob) {
    if (!user) return
    cropper.close()
    setUploading(true)
    try {
      const url = await uploadBlob(blob, mediaPaths.avatar(user.id))
      const oldUrl = profile?.avatar_url
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      if (error) {
        await removeMediaByUrl(url)
        throw new Error('프로필 사진을 저장하지 못했어요.')
      }
      await removeMediaByUrl(oldUrl) // 예전 사진 정리
      await refreshProfile()
      setNotice('프로필 사진을 바꿨어요.')
    } catch (err) {
      setError((err as Error).message || '프로필 사진을 바꾸지 못했어요.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveAvatar() {
    if (!user || !profile?.avatar_url) return
    setError('')
    setUploading(true)
    const oldUrl = profile.avatar_url
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (error) setError('프로필 사진을 지우지 못했어요.')
    else {
      await removeMediaByUrl(oldUrl)
      await refreshProfile()
      setNotice('프로필 사진을 지웠어요.')
    }
    setUploading(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut() // 로그아웃되면 보호 라우트가 자동으로 로그인 화면으로 보냄
    } catch (err) {
      setError((err as Error).message)
      setSigningOut(false)
    }
  }

  return (
    <>
      <PageHeader title="프로필" />

      <div className="space-y-8 px-4 py-6 lg:mx-auto lg:max-w-xl lg:py-10">
        {/* 프로필 사진 */}
        <section className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            aria-label="프로필 사진 바꾸기"
            className="relative"
          >
            <Avatar url={profile?.avatar_url} name={profile?.nickname} className="size-28 text-4xl" />
            <span className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center border-2 border-ink bg-accent text-paper">
              {uploading ? <Spinner className="size-4" /> : <CameraIcon className="size-5" />}
            </span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          {cropper.target && (
            <ImageCropModal
              file={cropper.target.file}
              src={cropper.target.src}
              title="프로필 사진 맞추기"
              aspect={1}
              outputWidth={IMAGE_SIZE.avatar}
              onCancel={cropper.close}
              onDone={uploadCroppedAvatar}
            />
          )}
          {profile?.avatar_url && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={uploading}
              className="text-sm text-gray-400 underline-offset-2 active:underline"
            >
              사진 지우기
            </button>
          )}
          <p className="text-sm text-gray-500">{user.email}</p>
        </section>

        {/* 고유코드 (친구 찾기용) */}
        <section className="space-y-2">
          <MyFriendCode code={profile?.friend_code} />
          <Link to="/explore?tab=accounts" className="block py-1 text-center text-sm font-semibold text-indigo-500">
            친구 목록 · 친구 찾기 ▶
          </Link>
        </section>

        {/* 닉네임 */}
        <form onSubmit={handleSaveNickname} className="space-y-3">
          <TextField
            label="닉네임"
            maxLength={30}
            value={nickname}
            onChange={(e) => setDraftName(e.target.value)}
            hint={`${trimmed.length}/30`}
          />
          <Button type="submit" loading={savingName} disabled={!nameChanged}>
            닉네임 저장
          </Button>
        </form>

        <ErrorText>{error}</ErrorText>

        {/* 비밀번호 변경 */}
        <section className="space-y-3 border-t border-gray-100 pt-6">
          {showPassword ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-ink">비밀번호 변경</h2>
                <button type="button" onClick={() => setShowPassword(false)} className="px-2 py-2 text-sm text-gray-500">
                  닫기
                </button>
              </div>
              <ChangePasswordForm
                onDone={() => {
                  setShowPassword(false)
                  setNotice('비밀번호를 바꿨어요.')
                }}
              />
            </>
          ) : (
            <Button variant="secondary" onClick={() => setShowPassword(true)}>
              비밀번호 변경
            </Button>
          )}
        </section>

        <section className="border-t border-gray-100 pt-6">
          <Button variant="danger" onClick={handleSignOut} loading={signingOut}>
            로그아웃
          </Button>
        </section>
      </div>

      {/* 저장 완료 안내 (토스트) */}
      {notice && (
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <p className="border-2 border-paper bg-ink px-4 py-2 text-sm text-paper shadow-md">{notice}</p>
        </div>
      )}
    </>
  )
}
