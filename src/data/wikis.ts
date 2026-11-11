import { extractImageUrls } from '../lib/richText'
import { IMAGE_SIZE, mediaPaths, removeMediaUrls, uploadResizedImage } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Wiki } from '../lib/types'
import { check, NotFoundError } from './db'

const WIKI_COLUMNS = 'id, owner_id, name, description, cover_url, theme_color, visibility, created_at'

export type WikiWithCount = Wiki & { characterCount: number }

/** 내 위키 목록 (최근 만든 순) + 캐릭터 수 */
export async function listMyWikis(userId: string): Promise<WikiWithCount[]> {
  const wikis = check(
    await supabase.from('wikis').select(WIKI_COLUMNS).eq('owner_id', userId).order('created_at', { ascending: false }),
    '위키 목록을 불러오지 못했어요.',
  ) as Wiki[]
  if (wikis.length === 0) return []

  const chars = check(
    await supabase.from('characters').select('wiki_id').in('wiki_id', wikis.map((w) => w.id)),
    '위키 목록을 불러오지 못했어요.',
  ) as { wiki_id: string }[]
  const counts = new Map<string, number>()
  for (const c of chars) counts.set(c.wiki_id, (counts.get(c.wiki_id) ?? 0) + 1)

  return wikis.map((w) => ({ ...w, characterCount: counts.get(w.id) ?? 0 }))
}

export async function getWiki(id: string): Promise<Wiki> {
  const wiki = check(
    await supabase.from('wikis').select(WIKI_COLUMNS).eq('id', id).maybeSingle(),
    '위키를 불러오지 못했어요.',
  ) as Wiki | null
  if (!wiki) throw new NotFoundError('위키를 찾을 수 없어요. 지워졌거나 볼 권한이 없어요.')
  return wiki
}

export type WikiInput = {
  name: string
  description: string
  theme_color: string
}

/**
 * 위키 만들기.
 * 표지 이미지 경로에 위키 id 가 들어가므로 id 를 먼저 정하고 표지를 올린 뒤 저장합니다.
 */
export async function createWiki(userId: string, input: WikiInput, coverFile: File | null): Promise<Wiki> {
  const id = crypto.randomUUID()
  const cover_url = coverFile
    ? await uploadResizedImage(coverFile, mediaPaths.wikiCover(userId, id), IMAGE_SIZE.cover)
    : null

  const res = await supabase
    .from('wikis')
    .insert({ id, owner_id: userId, ...input, cover_url })
    .select(WIKI_COLUMNS)
    .single()
  if (res.error) await removeMediaUrls([cover_url])
  return check(res, '위키를 만들지 못했어요.') as Wiki
}

/**
 * 위키 수정.
 * cover: undefined = 그대로, null = 표지 지우기, File = 새 표지로 바꾸기
 */
export async function updateWiki(
  userId: string,
  wiki: Wiki,
  input: WikiInput,
  cover: File | null | undefined,
): Promise<Wiki> {
  let cover_url = wiki.cover_url
  if (cover instanceof File) cover_url = await uploadResizedImage(cover, mediaPaths.wikiCover(userId, wiki.id), IMAGE_SIZE.cover)
  else if (cover === null) cover_url = null

  const res = await supabase
    .from('wikis')
    .update({ ...input, cover_url })
    .eq('id', wiki.id)
    .select(WIKI_COLUMNS)
    .single()
  if (res.error) {
    if (cover_url !== wiki.cover_url) await removeMediaUrls([cover_url])
    check(res, '위키를 저장하지 못했어요.')
  }
  if (cover_url !== wiki.cover_url) await removeMediaUrls([wiki.cover_url]) // 예전 표지 정리
  return res.data as Wiki
}

/** 위키 삭제 (방·캐릭터·항목·이미지·로그가 모두 함께 지워지고, 이미지 파일도 정리) */
export async function deleteWiki(wiki: Wiki) {
  // 지우기 전에 정리할 파일 주소를 모아 둠
  const chars = check(
    await supabase.from('characters').select('id').eq('wiki_id', wiki.id),
    '위키를 삭제하지 못했어요.',
  ) as { id: string }[]
  const charIds = chars.map((c) => c.id)
  const urls: (string | null)[] = [wiki.cover_url]
  if (charIds.length > 0) {
    const images = check(
      await supabase.from('character_images').select('image_url, thumb_url').in('character_id', charIds),
      '위키를 삭제하지 못했어요.',
    ) as { image_url: string; thumb_url: string }[]
    const logs = check(
      await supabase.from('character_logs').select('body').in('character_id', charIds),
      '위키를 삭제하지 못했어요.',
    ) as { body: string }[]
    for (const img of images) urls.push(img.image_url, img.thumb_url)
    for (const log of logs) urls.push(...extractImageUrls(log.body))
  }

  check(await supabase.from('wikis').delete().eq('id', wiki.id), '위키를 삭제하지 못했어요.')
  await removeMediaUrls(urls)
}
