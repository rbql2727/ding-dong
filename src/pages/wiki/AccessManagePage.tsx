import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { listWikiRequests, setRequestStatus, type RequestWithProfile } from '../../data/sharing'
import { getWiki } from '../../data/wikis'
import { ConfirmModal } from '../../components/Modal'
import { Avatar, BackHeader, ErrorScreen, InlineLoading } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { themeStyle } from '../../lib/theme'
import type { RequestStatus } from '../../lib/types'
import { useLoad } from '../../lib/useLoad'
import { visibilityLabel } from '../../lib/visibility'

async function load(wikiId: string) {
  const [wiki, requests] = await Promise.all([getWiki(wikiId), listWikiRequests(wikiId)])
  return { wiki, requests }
}

/** 열람 승인 관리 (/w/:wikiId/access) — 위키 주인만 */
export function AccessManagePage() {
  const { wikiId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, reload, setData } = useLoad(() => load(wikiId), [wikiId])
  const [revokeTarget, setRevokeTarget] = useState<RequestWithProfile | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const back = () => navigate(`/w/${wikiId}`)

  if (loading) return <InlineLoading />
  if (error || !data) {
    return (
      <>
        <BackHeader title="열람 승인 관리" onBack={back} />
        <ErrorScreen message={error ?? '불러오지 못했어요.'} onRetry={reload} />
      </>
    )
  }
  if (data.wiki.owner_id !== user?.id) {
    return (
      <>
        <BackHeader title="열람 승인 관리" onBack={back} />
        <ErrorScreen message="위키 주인만 볼 수 있어요." />
      </>
    )
  }

  const { wiki, requests } = data
  const pending = requests.filter((r) => r.status === 'pending')
  const approved = requests.filter((r) => r.status === 'approved')
  const rejected = requests.filter((r) => r.status === 'rejected')

  async function change(id: string, status: RequestStatus) {
    setBusyId(id)
    setActionError('')
    try {
      await setRequestStatus(id, status)
      setData((d) => ({ ...d, requests: d.requests.map((r) => (r.id === id ? { ...r, status } : r)) }))
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={themeStyle(wiki.theme_color)} className="pb-16">
      <BackHeader title="열람 승인 관리" onBack={back} />

      {wiki.visibility !== 'approved' && (
        <p className="mx-4 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          지금 이 위키는 <b>{visibilityLabel(wiki.visibility)}</b> 상태라 승인 여부와 상관없이 적용되지 않아요. 공개 범위를
          &lsquo;승인한 사람만&rsquo;으로 바꾸면 승인한 사람만 볼 수 있어요.
        </p>
      )}
      {actionError && <p className="mx-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>}

      <Section title="받은 요청" count={pending.length} empty="새 요청이 없어요.">
        {pending.map((r) => (
          <PersonRow key={r.id} req={r}>
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => change(r.id, 'rejected')}
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 active:bg-gray-50 disabled:opacity-50"
            >
              거절
            </button>
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => change(r.id, 'approved')}
              className="h-9 rounded-lg bg-(--wiki) px-3 text-sm font-semibold text-white active:brightness-95 disabled:opacity-50"
            >
              승인
            </button>
          </PersonRow>
        ))}
      </Section>

      <Section title="승인한 사람" count={approved.length} empty="아직 승인한 사람이 없어요.">
        {approved.map((r) => (
          <PersonRow key={r.id} req={r}>
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => setRevokeTarget(r)}
              className="h-9 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
            >
              철회
            </button>
          </PersonRow>
        ))}
      </Section>

      {rejected.length > 0 && (
        <Section title="거절·철회한 요청" count={rejected.length}>
          {rejected.map((r) => (
            <PersonRow key={r.id} req={r}>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => change(r.id, 'approved')}
                className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 active:bg-gray-50 disabled:opacity-50"
              >
                승인
              </button>
            </PersonRow>
          ))}
        </Section>
      )}

      <ConfirmModal
        open={!!revokeTarget}
        title="열람 권한을 철회할까요?"
        message={`${revokeTarget?.requester?.nickname ?? '이 사용자'}님은 바로 이 위키를 볼 수 없게 돼요. (다시 요청할 수는 있어요)`}
        confirmText="철회"
        danger
        onConfirm={async () => {
          if (revokeTarget) await change(revokeTarget.id, 'rejected')
        }}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  )
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: ReactNode }) {
  return (
    <section className="mt-6 px-4">
      <h2 className="mb-2 flex items-baseline gap-2 font-bold">
        {title}
        <span className="text-sm font-normal text-gray-400">{count}</span>
      </h2>
      {count === 0 && empty ? <p className="py-4 text-sm text-gray-400">{empty}</p> : <ul className="divide-y divide-gray-100">{children}</ul>}
    </section>
  )
}

function PersonRow({ req, children }: { req: RequestWithProfile; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar url={req.requester?.avatar_url} name={req.requester?.nickname} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{req.requester?.nickname ?? '알 수 없는 사용자'}</p>
        <p className="text-xs text-gray-400">{formatDate(req.created_at)} 요청</p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  )
}
