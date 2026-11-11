import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { createWiki, deleteWiki, getWiki, updateWiki } from '../../data/wikis'
import { ConfirmModal } from '../../components/Modal'
import { ImageIcon } from '../../components/icons'
import { BackHeader, Button, ErrorScreen, ErrorText, InlineLoading, TextArea, TextField } from '../../components/ui'
import { checkImageFile } from '../../lib/image'
import { DEFAULT_THEME_COLOR, THEME_COLORS, themeStyle } from '../../lib/theme'
import type { Wiki } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'

/** 위키 만들기 (/wikis/new) */
export function WikiCreatePage() {
  const navigate = useNavigate()
  return <WikiForm onBack={() => navigate('/wikis')} />
}

/** 위키 설정 (/w/:wikiId/settings) */
export function WikiSettingsPage() {
  const { wikiId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: wiki, loading, error, reload } = useLoad(() => getWiki(wikiId), [wikiId])
  const back = () => navigate(`/w/${wikiId}`)

  if (loading) return <InlineLoading />
  if (error || !wiki) return <ErrorScreen message={error ?? '위키를 찾을 수 없어요.'} onRetry={reload} />
  if (wiki.owner_id !== user?.id) {
    return (
      <>
        <BackHeader title="위키 설정" onBack={back} />
        <ErrorScreen message="위키 주인만 설정을 바꿀 수 있어요." />
      </>
    )
  }
  return <WikiForm wiki={wiki} onBack={back} />
}

function WikiForm({ wiki, onBack }: { wiki?: Wiki; onBack: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isNew = !wiki

  const [name, setName] = useState(wiki?.name ?? '')
  const [description, setDescription] = useState(wiki?.description ?? '')
  const [themeColor, setThemeColor] = useState(wiki?.theme_color ?? DEFAULT_THEME_COLOR)
  // undefined = 그대로, null = 지우기, { file, url } = 새로 고름 (url 은 미리보기용)
  const [cover, setCover] = useState<{ file: File; url: string } | null | undefined>(undefined)
  const previewUrlRef = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // 화면을 떠날 때 미리보기 주소 정리
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  function changeCover(next: { file: File; url: string } | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = next?.url ?? null
    setCover(next)
  }

  const shownCover = cover === undefined ? wiki?.cover_url ?? null : cover?.url ?? null

  function handlePickCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = checkImageFile(file)
    if (problem) return setError(problem)
    setError('')
    changeCover({ file, url: URL.createObjectURL(file) })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const input = { name: name.trim(), description: description.trim(), theme_color: themeColor }
    if (!input.name) return setError('위키 이름을 입력해 주세요.')

    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const created = await createWiki(user.id, input, cover?.file ?? null)
        navigate(`/w/${created.id}`, { replace: true })
      } else {
        await updateWiki(user.id, wiki, input, cover === undefined ? undefined : cover?.file ?? null)
        navigate(`/w/${wiki.id}`, { replace: true })
      }
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div style={themeStyle(themeColor)}>
      <BackHeader title={isNew ? '새 위키' : '위키 설정'} onBack={onBack} />

      <form onSubmit={handleSubmit} className="space-y-6 px-4 pt-4 pb-28">
        {/* 표지 */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-700">표지 이미지</span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-(--wiki) text-white/90"
          >
            {shownCover ? (
              <img src={shownCover} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-sm font-medium">
                <ImageIcon className="size-8" />
                눌러서 표지 고르기
              </span>
            )}
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handlePickCover} />
          {shownCover && (
            <div className="mt-2 flex gap-3 text-sm">
              <button type="button" className="text-gray-600" onClick={() => fileInput.current?.click()}>
                다른 사진으로
              </button>
              <button type="button" className="text-gray-400" onClick={() => changeCover(null)}>
                표지 지우기
              </button>
            </div>
          )}
        </div>

        <TextField
          label="위키 이름"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 별빛 학원 캐릭터 모음"
        />

        <TextArea
          id="wiki-description"
          label="소개"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="이 위키를 한두 문장으로 소개해 주세요."
          hint={`${description.length}/2000`}
        />

        {/* 테마 색 */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">테마 색</legend>
          <div className="flex flex-wrap gap-3">
            {THEME_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`색 ${c}`}
                aria-pressed={themeColor === c}
                onClick={() => setThemeColor(c)}
                style={{ backgroundColor: c }}
                className={`size-9 rounded-full ${themeColor === c ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
              />
            ))}
            <label
              className={`relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200 text-xs text-gray-500 ${
                THEME_COLORS.includes(themeColor) ? '' : 'ring-2 ring-gray-900 ring-offset-2'
              }`}
              style={THEME_COLORS.includes(themeColor) ? undefined : { backgroundColor: themeColor }}
              title="직접 고르기"
            >
              {THEME_COLORS.includes(themeColor) && '직접'}
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </fieldset>

        <ErrorText>{error}</ErrorText>

        {!isNew && (
          <div className="border-t border-gray-100 pt-6">
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
              위키 삭제
            </Button>
          </div>
        )}

        {/* 저장 버튼 (화면 아래 고정) */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-md">
            <Button type="submit" variant="theme" loading={saving}>
              {isNew ? '위키 만들기' : '저장'}
            </Button>
          </div>
        </div>
      </form>

      {wiki && (
        <ConfirmModal
          open={confirmDelete}
          title="위키를 삭제할까요?"
          message={
            <>
              <b>{wiki.name}</b> 안의 방, 캐릭터, 이미지, 로그가 <b>모두 지워지고 되돌릴 수 없어요.</b>
            </>
          }
          confirmText="삭제"
          danger
          onConfirm={async () => {
            await deleteWiki(wiki)
            navigate('/wikis', { replace: true })
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
