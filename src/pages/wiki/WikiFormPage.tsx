import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getShareToken, regenerateShareToken, shareUrl } from '../../data/sharing'
import { createWiki, deleteWiki, getWiki, setAllCharactersVisibility, updateWiki } from '../../data/wikis'
import { ConfirmModal } from '../../components/Modal'
import { ImageIcon } from '../../components/icons'
import { BackHeader, Button, ErrorScreen, ErrorText, InlineLoading, TextArea, TextField } from '../../components/ui'
import { checkImageFile } from '../../lib/image'
import { DEFAULT_THEME_COLOR, THEME_COLORS, themeStyle } from '../../lib/theme'
import type { Visibility, Wiki } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'
import { MediaImg } from '../../components/MediaImg'
import { VisibilityPicker } from '../../components/VisibilityPicker'

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
  const [visibility, setVisibility] = useState<Visibility>(wiki?.visibility ?? 'private')
  // 공개 범위를 바꿀 때 캐릭터들에도 같이 적용할지
  const [applyToCharacters, setApplyToCharacters] = useState(true)
  const visibilityChanged = !!wiki && wiki.visibility !== visibility
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
    const input = { name: name.trim(), description: description.trim(), theme_color: themeColor, visibility }
    if (!input.name) return setError('위키 이름을 입력해 주세요.')

    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const created = await createWiki(user.id, input, cover?.file ?? null)
        navigate(`/w/${created.id}`, { replace: true })
      } else {
        await updateWiki(user.id, wiki, input, cover === undefined ? undefined : cover?.file ?? null)
        if (visibilityChanged && applyToCharacters) await setAllCharactersVisibility(wiki.id, visibility)
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
              <MediaImg src={shownCover} alt="" className="absolute inset-0 size-full object-cover" />
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
                className={`size-9 ${themeColor === c ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
              />
            ))}
            <label
              className={`relative flex size-9 cursor-pointer items-center justify-center overflow-hidden border border-gray-200 text-xs text-gray-500 ${
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

        <VisibilityPicker
          name="wiki-visibility"
          value={visibility}
          onChange={setVisibility}
          hint={isNew ? '처음에는 비공개로 두고, 정리가 끝나면 바꿔도 돼요.' : undefined}
        />
        {visibilityChanged && (
          <label className="-mt-3 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={applyToCharacters}
              onChange={(e) => setApplyToCharacters(e.target.checked)}
              className="mt-0.5 accent-(--wiki)"
            />
            <span>
              모든 캐릭터에도 같은 공개 범위 적용
              <span className="block text-xs text-gray-400">
                끄면 캐릭터마다 설정한 공개 범위가 그대로 남아요. 캐릭터는 위키와 캐릭터 공개 범위를 둘 다 통과해야 보여요.
              </span>
            </span>
          </label>
        )}

        {wiki && <ShareLinkSection wiki={wiki} pendingVisibility={visibility} />}

        <ErrorText>{error}</ErrorText>

        {!isNew && (
          <div className="border-t border-gray-100 pt-6">
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
              위키 삭제
            </Button>
          </div>
        )}

        {/* 저장 버튼 (화면 아래 고정) */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-3 border-ink bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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

/** 공유 링크 (링크 공개일 때만 작동) */
function ShareLinkSection({ wiki, pendingVisibility }: { wiki: Wiki; pendingVisibility: Visibility }) {
  const { data: token, setData, loading } = useLoad(() => getShareToken(wiki.id), [wiki.id])
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  if (pendingVisibility !== 'link') return null
  if (wiki.visibility !== 'link') {
    return <p className="-mt-3 text-sm text-gray-500">저장하면 공유 링크를 만들 수 있어요.</p>
  }
  if (loading || !token) return null
  const url = shareUrl(token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('아래 링크를 복사하세요.', url)
    }
  }

  return (
    <section className="-mt-2 rounded-xl border border-gray-200 p-3">
      <p className="mb-2 text-sm font-semibold">공유 링크</p>
      <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs break-all text-gray-600">{url}</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="h-10 text-sm" onClick={copy}>
          {copied ? '복사했어요!' : '링크 복사'}
        </Button>
        <Button type="button" variant="secondary" className="h-10 text-sm" onClick={() => setConfirmRegen(true)}>
          새 링크 만들기
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-400">링크를 받은 사람은 로그인한 뒤 볼 수 있어요. 새 링크를 만들면 예전 링크로 들어온 사람은 더 이상 못 봐요.</p>
      <ConfirmModal
        open={confirmRegen}
        title="새 링크를 만들까요?"
        message="지금까지의 링크는 작동하지 않고, 그 링크로 들어왔던 사람들도 다시 볼 수 없게 돼요."
        confirmText="새로 만들기"
        onConfirm={async () => {
          const next = await regenerateShareToken(wiki.id)
          setData(() => next)
        }}
        onClose={() => setConfirmRegen(false)}
      />
    </section>
  )
}
