import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { cancelAccessRequest, requestAccess, requestAgain } from '../../data/sharing'
import { MediaImg } from '../../components/MediaImg'
import { BackIcon } from '../../components/icons'
import { Button, ErrorText, IconButton } from '../../components/ui'
import { themeStyle } from '../../lib/theme'
import type { WikiPreview } from '../../lib/types'

/**
 * 아직 볼 권한이 없는 "승인한 사람만" 위키: 제목·표지·주인만 보여 주고 열람 요청을 받음.
 * (내용은 DB 가 아예 돌려주지 않으므로 여기서 숨기는 게 아니라 원래 없음)
 */
export function LockedWikiView({ preview, onChanged }: { preview: WikiPreview; onChanged: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const status = preview.my_request_status

  async function run(action: () => Promise<void>) {
    if (!user) return
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={themeStyle(preview.theme_color)} className="pb-16">
      <section className="relative">
        <div className="relative h-44 bg-(--wiki)">
          {preview.cover_url && <MediaImg src={preview.cover_url} alt="" decoding="async" className="size-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/10" />
        </div>
        <div className="absolute inset-x-0 top-0 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
          <IconButton label="뒤로 가기" onClick={() => navigate(-1)} className="text-white active:bg-white/20">
            <BackIcon />
          </IconButton>
        </div>
      </section>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-bold break-words text-gray-900">{preview.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{preview.owner_nickname}</p>
      </div>

      <div className="mx-4 mt-8 rounded-2xl bg-gray-50 px-5 py-8 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm" aria-hidden>
          🔒
        </div>
        <p className="font-semibold text-gray-900">승인한 사람만 볼 수 있는 위키예요</p>

        {status === null && (
          <>
            <p className="mt-1 text-sm text-gray-500">열람을 요청하면 주인이 승인한 뒤 볼 수 있어요.</p>
            <Button variant="theme" className="mt-5" loading={busy} onClick={() => run(() => requestAccess(preview.id, user!.id))}>
              열람 요청
            </Button>
          </>
        )}

        {status === 'pending' && (
          <>
            <p className="mt-1 text-sm text-gray-500">열람 요청을 보냈어요. 주인이 승인하면 볼 수 있어요.</p>
            <p className="mt-4 inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-(--wiki)">승인 대기 중</p>
            <Button variant="secondary" className="mt-4" loading={busy} onClick={() => run(() => cancelAccessRequest(preview.id, user!.id))}>
              요청 취소
            </Button>
          </>
        )}

        {status === 'rejected' && (
          <>
            <p className="mt-1 text-sm text-gray-500">요청이 거절되었거나 열람 권한이 철회되었어요.</p>
            <Button variant="secondary" className="mt-5" loading={busy} onClick={() => run(() => requestAgain(preview.id, user!.id))}>
              다시 요청하기
            </Button>
          </>
        )}

        {status === 'approved' && (
          // 승인됐는데도 못 보는 경우: 주인이 공개 범위를 바꾼 경우 등
          <p className="mt-1 text-sm text-gray-500">승인은 되어 있지만 지금은 볼 수 없어요. 주인이 공개 범위를 바꿨을 수 있어요.</p>
        )}

        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  )
}
