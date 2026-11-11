import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getCharacterFull } from '../../data/characters'
import { createLog, deleteLog, getLog, updateLog, uploadLogImage } from '../../data/logs'
import { getWiki } from '../../data/wikis'
import { LogEditor, type LogEditorHandle } from '../../components/log/LogEditor'
import { LogViewer } from '../../components/log/LogViewer'
import { ChatLogEditor, type ChatLogEditorHandle } from '../../components/log/ChatLogEditor'
import { isChatBody, parseChatBody } from '../../lib/chatLog'
import { ConfirmModal } from '../../components/Modal'
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
      <article className="px-4 pt-5 lg:mx-auto lg:max-w-3xl lg:px-8 lg:pt-8">
        <h1 className="font-title text-xl break-words text-gray-900">{log.title}</h1>
        <p className="mt-1 text-xs text-gray-400">
          {formatDateTime(log.created_at)}
          {edited && ` · 수정됨 ${formatDateTime(log.updated_at)}`}
        </p>
        <div className="mt-2 mb-5 h-0.5 w-8 bg-(--wiki)" />
        {log.body.trim() ? <LogViewer body={log.body} charName={characterName} /> : <p className="text-gray-400">본문이 없어요.</p>}
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
  return (
    <LogEditForm key={logId ?? 'new'} wiki={data.wiki} charId={charId} charName={data.characterName} log={data.log} onBack={back} />
  )
}

function LogEditForm({
  wiki,
  charId,
  charName,
  log,
  onBack,
}: {
  wiki: Wiki
  charId: string
  charName: string
  log?: CharacterLog
  onBack: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState(log?.title ?? '')
  const editorRef = useRef<LogEditorHandle>(null)
  const chatRef = useRef<ChatLogEditorHandle>(null)
  // 쓰는 방식: 글(툴바 편집기) / 채팅 로그(말풍선 정리)
  const [mode, setMode] = useState<'doc' | 'chat'>(log && isChatBody(log.body) ? 'chat' : 'doc')
  const startedAs = log && isChatBody(log.body) ? 'chat' : 'doc'
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
      const body = (mode === 'chat' ? chatRef.current?.getBody() : editorRef.current?.getBody()) ?? ''
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
      <form id="log-form" onSubmit={handleSubmit} className="space-y-3 px-4 pt-4 pb-10 lg:mx-auto lg:max-w-3xl lg:px-8 lg:pt-8">
        <input
          aria-label="제목"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="px-input h-12 w-full px-3 font-title text-lg"
        />
        {/* 쓰는 방식 고르기 */}
        <div role="tablist" aria-label="쓰는 방식" className="flex gap-1.5">
          {(
            [
              ['doc', '글로 쓰기'],
              ['chat', '채팅 로그'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-btn h-10 flex-1 text-sm font-bold ${mode === m ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== startedAs && log?.body && (
          <p className="border-2 border-dashed border-accent px-3 py-2 text-xs text-gray-600">
            저장하면 지금 고른 방식으로 바뀌고, 예전 {startedAs === 'chat' ? '채팅 로그' : '글'} 내용은 사라져요.
          </p>
        )}
        {/* 두 편집기를 모두 유지해서, 방식을 바꿔 봐도 쓰던 내용이 남아 있게 */}
        <div hidden={mode !== 'doc'}>
          <LogEditor ref={editorRef} initialBody={log && !isChatBody(log.body) ? log.body : ''} onUploadImage={uploadImage} />
        </div>
        <div hidden={mode !== 'chat'}>
          <ChatLogEditor ref={chatRef} initialParts={log && isChatBody(log.body) ? parseChatBody(log.body) : []} charName={charName} />
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </div>
  )
}
