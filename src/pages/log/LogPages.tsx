import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getCharacterFull } from '../../data/characters'
import { createLog, deleteLog, getLog, updateLog, uploadLogImage } from '../../data/logs'
import { getWiki } from '../../data/wikis'
import { LogBodyEditor } from '../../components/LogBodyEditor'
import { ConfirmModal } from '../../components/Modal'
import { RichText } from '../../components/RichText'
import { PencilIcon, TrashIcon } from '../../components/icons'
import { BackHeader, Button, ErrorScreen, ErrorText, IconButton, InlineLoading } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import { extractImageUrls } from '../../lib/richText'
import { removeMediaUrls } from '../../lib/storage'
import { themeStyle } from '../../lib/theme'
import type { CharacterLog, Wiki } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'

async function loadLogContext(wikiId: string, charId: string, logId: string | undefined) {
  const [wiki, full, log] = await Promise.all([
    getWiki(wikiId),
    getCharacterFull(charId),
    logId ? getLog(logId) : Promise.resolve(undefined),
  ])
  return { wiki, characterName: full.character.name, log }
}

/** 로그 상세 (/w/:wikiId/c/:charId/logs/:logId) */
export function LogDetailPage() {
  const { wikiId = '', charId = '', logId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useLoad(() => loadLogContext(wikiId, charId, logId), [wikiId, charId, logId])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const backToList = () => navigate(`/w/${wikiId}/c/${charId}?tab=logs`)

  if (loading) return <InlineLoading />
  if (error || !data?.log) {
    return (
      <>
        <BackHeader title="로그" onBack={backToList} />
        <ErrorScreen message={error ?? '로그를 찾을 수 없어요.'} onRetry={reload} />
      </>
    )
  }

  const { wiki, characterName, log } = data
  const isOwner = wiki.owner_id === user?.id
  const edited = new Date(log.updated_at).getTime() - new Date(log.created_at).getTime() > 60_000

  return (
    <div style={themeStyle(wiki.theme_color)} className="pb-16">
      <BackHeader
        title={`${characterName}의 로그`}
        onBack={backToList}
        right={
          isOwner && (
            <>
              <IconButton label="로그 수정" onClick={() => navigate(`/w/${wikiId}/c/${charId}/logs/${logId}/edit`)}>
                <PencilIcon />
              </IconButton>
              <IconButton label="로그 삭제" onClick={() => setConfirmDelete(true)} className="text-red-500">
                <TrashIcon />
              </IconButton>
            </>
          )
        }
      />
      <article className="px-4 pt-5">
        <h1 className="text-xl font-bold break-words text-gray-900">{log.title}</h1>
        <p className="mt-1 text-xs text-gray-400">
          {formatDateTime(log.created_at)}
          {edited && ` · 수정됨 ${formatDateTime(log.updated_at)}`}
        </p>
        <div className="mt-2 mb-5 h-0.5 w-8 rounded-full bg-(--wiki)" />
        {log.body.trim() ? <RichText text={log.body} /> : <p className="text-gray-400">본문이 없어요.</p>}
      </article>

      <ConfirmModal
        open={confirmDelete}
        title="로그를 삭제할까요?"
        message="삭제한 로그는 되돌릴 수 없어요."
        confirmText="삭제"
        danger
        onConfirm={async () => {
          await deleteLog(log)
          navigate(`/w/${wikiId}/c/${charId}?tab=logs`, { replace: true })
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

/** 로그 쓰기 / 수정 (/logs/new, /logs/:logId/edit) */
export function LogEditorPage() {
  const { wikiId = '', charId = '', logId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useLoad(() => loadLogContext(wikiId, charId, logId), [wikiId, charId, logId])
  const back = () => navigate(logId ? `/w/${wikiId}/c/${charId}/logs/${logId}` : `/w/${wikiId}/c/${charId}?tab=logs`)

  if (loading) return <InlineLoading />
  if (error || !data || (logId && !data.log)) {
    return (
      <>
        <BackHeader title="로그" onBack={back} />
        <ErrorScreen message={error ?? '로그를 찾을 수 없어요.'} onRetry={reload} />
      </>
    )
  }
  if (data.wiki.owner_id !== user?.id) {
    return (
      <>
        <BackHeader title="로그" onBack={back} />
        <ErrorScreen message="위키 주인만 로그를 쓸 수 있어요." />
      </>
    )
  }
  return <LogEditor key={logId ?? 'new'} wiki={data.wiki} charId={charId} log={data.log} onBack={back} />
}

function LogEditor({ wiki, charId, log, onBack }: { wiki: Wiki; charId: string; log?: CharacterLog; onBack: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState(log?.title ?? '')
  const [body, setBody] = useState(log?.body ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // 이번 편집에서 새로 올린 이미지 (취소하거나 본문에서 지우면 정리)
  const uploadedThisSession = useRef<string[]>([])

  async function uploadImage(file: File) {
    const url = await uploadLogImage(user!.id, wiki.id, charId, file)
    uploadedThisSession.current.push(url)
    return url
  }

  /** 최종 본문에 없는 이미지 파일 정리 */
  async function cleanupUnused(finalBody: string | null) {
    const keep = new Set(finalBody ? extractImageUrls(finalBody) : extractImageUrls(log?.body ?? ''))
    const candidates = finalBody
      ? [...uploadedThisSession.current, ...extractImageUrls(log?.body ?? '')]
      : uploadedThisSession.current
    await removeMediaUrls(candidates.filter((u) => !keep.has(u)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return setError('제목을 입력해 주세요.')
    setSaving(true)
    setError('')
    try {
      const saved = log ? await updateLog(log.id, cleanTitle, body) : await createLog(charId, cleanTitle, body)
      await cleanupUnused(body)
      navigate(`/w/${wiki.id}/c/${charId}/logs/${saved.id}`, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  async function handleCancel() {
    await cleanupUnused(null) // 저장 안 하고 나가면 이번에 올린 이미지는 지움
    onBack()
  }

  return (
    <div style={themeStyle(wiki.theme_color)}>
      <BackHeader
        title={log ? '로그 수정' : '새 로그'}
        onBack={handleCancel}
        right={
          <Button type="submit" form="log-form" variant="theme" loading={saving} className="h-9! w-auto! px-4 text-sm">
            저장
          </Button>
        }
      />
      <form id="log-form" onSubmit={handleSubmit} className="space-y-3 px-4 pt-4 pb-10">
        <input
          aria-label="제목"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full border-b border-gray-200 py-2 text-xl font-bold outline-none placeholder:text-gray-300 focus:border-(--wiki)"
        />
        <LogBodyEditor value={body} onChange={setBody} onUploadImage={uploadImage} />
        <ErrorText>{error}</ErrorText>
      </form>
    </div>
  )
}
