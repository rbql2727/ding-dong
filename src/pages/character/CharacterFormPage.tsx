import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  deleteCharacter,
  getCharacterFull,
  saveCharacter,
  type CharacterFull,
  type FieldDraft,
  type ImageDraft,
} from '../../data/characters'
import { listRooms } from '../../data/rooms'
import { getWiki } from '../../data/wikis'
import { ConfirmModal } from '../../components/Modal'
import { CloseIcon, DownIcon, LeftIcon, PlusIcon, RightIcon, StarIcon, TrashIcon, UpIcon } from '../../components/icons'
import { BackHeader, Button, ErrorScreen, ErrorText, IconButton, InlineLoading, TextArea, TextField } from '../../components/ui'
import { checkImageFile } from '../../lib/image'
import { themeStyle } from '../../lib/theme'
import type { Room, Visibility, Wiki } from '../../lib/types'
import { visibilityLabel } from '../../lib/visibility'
import { useLoad } from '../../lib/useLoad'
import { MediaImg } from '../../components/MediaImg'
import { VisibilityPicker } from '../../components/VisibilityPicker'

/** 자주 쓰는 항목 이름 (눌러서 바로 추가) */
const FIELD_SUGGESTIONS = ['외모', '성격', '나이', '생일', '키', '좋아하는 것', '싫어하는 것', '배경', '관계', '대사']
const MAX_IMAGES = 30

async function loadForm(wikiId: string, charId: string | undefined) {
  const [wiki, rooms, full] = await Promise.all([
    getWiki(wikiId),
    listRooms(wikiId),
    charId ? getCharacterFull(charId) : Promise.resolve(undefined),
  ])
  return { wiki, rooms, full }
}

/** /w/:wikiId/c/new 와 /w/:wikiId/c/:charId/edit 에서 같이 씀 */
export function CharacterFormPage() {
  const { wikiId = '', charId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useLoad(() => loadForm(wikiId, charId), [wikiId, charId])
  const back = () => navigate(charId ? `/w/${wikiId}/c/${charId}` : `/w/${wikiId}`)

  if (loading) return <InlineLoading />
  if (error || !data) {
    return (
      <>
        <BackHeader title="캐릭터" onBack={back} />
        <ErrorScreen message={error ?? '불러오지 못했어요.'} onRetry={reload} />
      </>
    )
  }
  if (data.wiki.owner_id !== user?.id) {
    return (
      <>
        <BackHeader title="캐릭터" onBack={back} />
        <ErrorScreen message="위키 주인만 캐릭터를 고칠 수 있어요." />
      </>
    )
  }

  return (
    <CharacterForm
      key={charId ?? 'new'}
      wiki={data.wiki}
      rooms={data.rooms}
      full={data.full}
      initialRoomId={searchParams.get('room')}
      onBack={back}
    />
  )
}

function CharacterForm({
  wiki,
  rooms,
  full,
  initialRoomId,
  onBack,
}: {
  wiki: Wiki
  rooms: Room[]
  full?: CharacterFull
  initialRoomId: string | null
  onBack: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isNew = !full

  const [name, setName] = useState(full?.character.name ?? '')
  const [tagline, setTagline] = useState(full?.character.tagline ?? '')
  const [roomId, setRoomId] = useState<string | null>(
    full ? full.character.room_id : rooms.some((r) => r.id === initialRoomId) ? initialRoomId : null,
  )
  const [fields, setFields] = useState<FieldDraft[]>(
    full?.fields.map((f) => ({ key: f.id, id: f.id, label: f.label, content: f.content })) ?? [],
  )
  const [images, setImages] = useState<ImageDraft[]>(
    full?.images.map((img) => ({ kind: 'existing', key: img.id, image: img })) ?? [],
  )
  // 새 캐릭터는 위키와 같은 공개 범위로 시작
  const [visibility, setVisibility] = useState<Visibility>(full?.character.visibility ?? wiki.visibility)
  const [coverKey, setCoverKey] = useState<string | null>(full?.character.cover_image_id ?? null)

  const [error, setError] = useState('')
  const [progress, setProgress] = useState('') // 저장 중 안내
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // 새로 고른 이미지 미리보기 주소들 — 화면을 떠날 때 정리
  const previewUrls = useRef(new Set<string>())
  useEffect(() => {
    const urls = previewUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const saving = progress !== ''
  // 대표 이미지를 따로 안 골랐으면 첫 번째 이미지가 대표
  const effectiveCoverKey = images.some((d) => d.key === coverKey) ? coverKey : images[0]?.key ?? null

  // ---------------- 항목 ----------------
  function addField(label = '') {
    setFields((fs) => [...fs, { key: crypto.randomUUID(), label, content: '' }])
  }
  function updateField(key: string, patch: Partial<FieldDraft>) {
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  }
  function moveField(index: number, delta: -1 | 1) {
    setFields((fs) => move(fs, index, index + delta))
  }

  // ---------------- 이미지 ----------------
  function handlePickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError('')
    const room = MAX_IMAGES - images.length
    if (room <= 0) return setError(`이미지는 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.`)

    const accepted: ImageDraft[] = []
    for (const file of files.slice(0, room)) {
      const problem = checkImageFile(file)
      if (problem) {
        setError(`${file.name}: ${problem}`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      accepted.push({ kind: 'new', key: crypto.randomUUID(), file, previewUrl })
    }
    if (files.length > room) setError(`이미지는 최대 ${MAX_IMAGES}장까지예요. 앞의 ${room}장만 추가했어요.`)
    setImages((list) => [...list, ...accepted])
  }
  function removeImage(key: string) {
    setImages((list) => {
      const target = list.find((d) => d.key === key)
      if (target?.kind === 'new') {
        URL.revokeObjectURL(target.previewUrl)
        previewUrls.current.delete(target.previewUrl)
      }
      return list.filter((d) => d.key !== key)
    })
  }

  // ---------------- 저장 / 삭제 ----------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    const cleanName = name.trim()
    if (!cleanName) return setError('이름을 입력해 주세요.')
    const cleanFields = fields
      .map((f) => ({ ...f, label: f.label.trim(), content: f.content.trim() }))
      .filter((f) => f.label || f.content) // 완전히 빈 항목은 버림
    if (cleanFields.some((f) => !f.label)) return setError('항목 이름이 비어 있는 곳이 있어요.')

    setProgress('저장하는 중…')
    try {
      const id = await saveCharacter({
        userId: user.id,
        wikiId: wiki.id,
        existing: full,
        name: cleanName,
        tagline: tagline.trim(),
        roomId,
        visibility,
        fields: cleanFields,
        images,
        coverKey: effectiveCoverKey,
        onProgress: setProgress,
      })
      navigate(`/w/${wiki.id}/c/${id}`, { replace: true })
    } catch (err) {
      setError(
        `${(err as Error).message}${isNew ? '' : ' 일부만 저장됐을 수 있어요. 화면을 새로고침해서 확인해 주세요.'}`,
      )
      setProgress('')
    }
  }

  return (
    <div style={themeStyle(wiki.theme_color)}>
      <BackHeader title={isNew ? '새 캐릭터' : '캐릭터 편집'} onBack={onBack} />

      <form onSubmit={handleSubmit} className="space-y-8 px-4 pt-4 pb-28">
        {/* 기본 정보 */}
        <section className="space-y-4">
          <TextField label="이름" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="캐릭터 이름" />
          <TextField
            label="한줄소개"
            maxLength={200}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="예: 별을 쫓는 견습 마법사"
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">방</span>
            <select
              value={roomId ?? ''}
              onChange={(e) => setRoomId(e.target.value || null)}
              className="px-input h-12 w-full px-3 text-base"
            >
              <option value="">분류 없음</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* 이미지 */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold">이미지</h2>
            <span className="text-xs text-gray-400">
              {images.length}/{MAX_IMAGES} · ★ 대표 이미지
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {images.map((d, i) => {
              const src = d.kind === 'existing' ? d.image.thumb_url : d.previewUrl
              const isCover = d.key === effectiveCoverKey
              return (
                <li key={d.key} className="relative">
                  <div className={`aspect-square overflow-hidden rounded-xl bg-gray-100 ${isCover ? 'ring-3 ring-(--wiki)' : ''}`}>
                    <MediaImg src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoverKey(d.key)}
                    aria-label="대표 이미지로"
                    className={`absolute top-1 left-1 flex size-7 items-center justify-center ${
                      isCover ? 'bg-(--wiki) text-white' : 'bg-black/40 text-white'
                    }`}
                  >
                    <StarIcon filled={isCover} className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(d.key)}
                    aria-label="이미지 빼기"
                    className="absolute top-1 right-1 flex size-7 items-center justify-center bg-black/40 text-white"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                  <div className="mt-1 flex justify-center">
                    <IconButton label="앞으로" className="size-8" disabled={i === 0} onClick={() => setImages((l) => move(l, i, i - 1))}>
                      <LeftIcon className="size-4" />
                    </IconButton>
                    <IconButton
                      label="뒤로"
                      className="size-8"
                      disabled={i === images.length - 1}
                      onClick={() => setImages((l) => move(l, i, i + 1))}
                    >
                      <RightIcon className="size-4" />
                    </IconButton>
                  </div>
                </li>
              )
            })}
            {images.length < MAX_IMAGES && (
              <li>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-500 active:bg-gray-50"
                >
                  <PlusIcon className="size-6" />
                  사진 추가
                </button>
              </li>
            )}
          </ul>
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
          <p className="mt-2 text-xs text-gray-400">여러 장을 한 번에 고를 수 있어요. 저장할 때 자동으로 크기를 줄여서 올려요.</p>
        </section>

        {/* 자유 항목 */}
        <section>
          <h2 className="mb-1 font-bold">항목</h2>
          <p className="mb-3 text-xs text-gray-400">외모, 성격처럼 원하는 항목을 자유롭게 만들어요.</p>

          <ul className="space-y-3">
            {fields.map((f, i) => (
              <li key={f.key} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="mb-2 flex items-center gap-1">
                  <input
                    aria-label="항목 이름"
                    value={f.label}
                    maxLength={50}
                    onChange={(e) => updateField(f.key, { label: e.target.value })}
                    placeholder="항목 이름 (예: 외모)"
                    className="px-input h-10 min-w-0 flex-1 px-3 font-bold"
                  />
                  <IconButton label="위로" className="size-9" disabled={i === 0} onClick={() => moveField(i, -1)}>
                    <UpIcon className="size-5" />
                  </IconButton>
                  <IconButton label="아래로" className="size-9" disabled={i === fields.length - 1} onClick={() => moveField(i, 1)}>
                    <DownIcon className="size-5" />
                  </IconButton>
                  <IconButton
                    label="항목 삭제"
                    className="size-9 text-red-500"
                    onClick={() => setFields((fs) => fs.filter((x) => x.key !== f.key))}
                  >
                    <TrashIcon className="size-5" />
                  </IconButton>
                </div>
                <TextArea
                  aria-label={`${f.label || '항목'} 내용`}
                  value={f.content}
                  maxLength={20000}
                  onChange={(e) => updateField(f.key, { content: e.target.value })}
                  placeholder="내용"
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => addField()}
            className="mt-3 flex h-12 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 font-medium text-gray-600 active:bg-gray-50"
          >
            <PlusIcon className="size-5" />
            항목 추가
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {FIELD_SUGGESTIONS.filter((s) => !fields.some((f) => f.label.trim() === s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addField(s)}
                className="border-2 border-ink bg-paper px-2.5 py-1 text-sm text-ink active:bg-gray-100"
              >
                + {s}
              </button>
            ))}
          </div>
        </section>

        {/* 공개 범위 */}
        <section>
          <VisibilityPicker
            name="character-visibility"
            legend="캐릭터 공개 범위"
            value={visibility}
            onChange={setVisibility}
            hint={`위키 공개 범위(${visibilityLabel(wiki.visibility)})와 캐릭터 공개 범위를 둘 다 통과한 사람만 볼 수 있어요. 이 캐릭터만 숨기려면 '비공개'를 고르세요. 로그도 이 설정을 따라요.`}
          />
        </section>

        <ErrorText>{error}</ErrorText>

        {!isNew && (
          <section className="border-t border-gray-100 pt-6">
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
              캐릭터 삭제
            </Button>
          </section>
        )}

        {/* 저장 버튼 (화면 아래 고정) */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-3 border-ink bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            <Button type="submit" variant="theme" loading={saving}>
              {saving ? progress : isNew ? '캐릭터 만들기' : '저장'}
            </Button>
          </div>
        </div>
      </form>

      {full && (
        <ConfirmModal
          open={confirmDelete}
          title="캐릭터를 삭제할까요?"
          message={
            <>
              <b>{full.character.name}</b>의 항목, 이미지, 로그가 <b>모두 지워지고 되돌릴 수 없어요.</b>
            </>
          }
          confirmText="삭제"
          danger
          onConfirm={async () => {
            await deleteCharacter(full)
            navigate(`/w/${wiki.id}`, { replace: true })
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

/** 배열에서 from 위치의 항목을 to 위치로 옮긴 새 배열 */
function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
