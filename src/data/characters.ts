import { extractImageUrls } from '../lib/richText'
import { mediaPaths, removeMediaUrls, uploadImageWithThumb } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Character, CharacterField, CharacterImage, Visibility } from '../lib/types'
import { check, NotFoundError } from './db'

const CHAR_COLUMNS = 'id, wiki_id, room_id, name, tagline, cover_image_id, visibility, sort_order, created_at'
const FIELD_COLUMNS = 'id, character_id, label, content, sort_order'
const IMAGE_COLUMNS = 'id, character_id, image_url, thumb_url, sort_order'

/** 목록 카드용: 캐릭터 + 대표 썸네일 주소 (원본은 불러오지 않음) */
export type CharacterCard = Character & { thumbUrl: string | null }

export async function listCharacters(wikiId: string): Promise<CharacterCard[]> {
  const chars = check(
    await supabase
      .from('characters')
      .select(CHAR_COLUMNS)
      .eq('wiki_id', wikiId)
      .order('sort_order')
      .order('created_at'),
    '캐릭터 목록을 불러오지 못했어요.',
  ) as Character[]
  if (chars.length === 0) return []

  // 썸네일 주소만 가져옴
  const images = check(
    await supabase
      .from('character_images')
      .select('id, character_id, thumb_url, sort_order')
      .in('character_id', chars.map((c) => c.id))
      .order('sort_order'),
    '캐릭터 목록을 불러오지 못했어요.',
  ) as Pick<CharacterImage, 'id' | 'character_id' | 'thumb_url' | 'sort_order'>[]

  return chars.map((c) => {
    const mine = images.filter((img) => img.character_id === c.id)
    const cover = mine.find((img) => img.id === c.cover_image_id) ?? mine[0]
    return { ...c, thumbUrl: cover?.thumb_url ?? null }
  })
}

export type CharacterFull = {
  character: Character
  fields: CharacterField[]
  images: CharacterImage[]
}

export async function getCharacterFull(id: string): Promise<CharacterFull> {
  const [charRes, fieldsRes, imagesRes] = await Promise.all([
    supabase.from('characters').select(CHAR_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('character_fields').select(FIELD_COLUMNS).eq('character_id', id).order('sort_order'),
    supabase.from('character_images').select(IMAGE_COLUMNS).eq('character_id', id).order('sort_order'),
  ])
  const character = check(charRes, '캐릭터를 불러오지 못했어요.') as Character | null
  if (!character) throw new NotFoundError('캐릭터를 찾을 수 없어요. 지워졌거나 볼 권한이 없어요.')
  return {
    character,
    fields: check(fieldsRes, '캐릭터를 불러오지 못했어요.') as CharacterField[],
    images: check(imagesRes, '캐릭터를 불러오지 못했어요.') as CharacterImage[],
  }
}

// ---------------------------------------------------------------------
// 캐릭터 저장 (새로 만들기 / 수정)
// ---------------------------------------------------------------------

/** 편집 중인 항목. id 가 없으면 새 항목 */
export type FieldDraft = { key: string; id?: string; label: string; content: string }

/** 편집 중인 이미지: 이미 올린 것 / 새로 고른 것(아직 안 올림) */
export type ImageDraft =
  | { kind: 'existing'; key: string; image: CharacterImage }
  | { kind: 'new'; key: string; file: File; previewUrl: string }

export type SaveCharacterInput = {
  userId: string
  wikiId: string
  /** 새 캐릭터면 undefined */
  existing?: CharacterFull
  name: string
  tagline: string
  roomId: string | null
  visibility: Visibility
  fields: FieldDraft[]
  images: ImageDraft[]
  /** 대표 이미지로 고른 ImageDraft 의 key (없으면 null) */
  coverKey: string | null
  onProgress?: (message: string) => void
}

export async function saveCharacter(input: SaveCharacterInput): Promise<string> {
  const { userId, wikiId, existing, onProgress } = input
  const isNew = !existing
  const characterId = existing?.character.id ?? crypto.randomUUID()

  // 1) 캐릭터 기본 정보
  onProgress?.('저장하는 중…')
  if (isNew) {
    const countRes = await supabase
      .from('characters')
      .select('id', { count: 'exact', head: true })
      .eq('wiki_id', wikiId)
    check(countRes, '캐릭터를 저장하지 못했어요.')
    check(
      await supabase.from('characters').insert({
        id: characterId,
        wiki_id: wikiId,
        room_id: input.roomId,
        name: input.name,
        tagline: input.tagline,
        visibility: input.visibility,
        sort_order: countRes.count ?? 0,
      }),
      '캐릭터를 저장하지 못했어요.',
    )
  } else {
    check(
      await supabase
        .from('characters')
        .update({ name: input.name, tagline: input.tagline, room_id: input.roomId, visibility: input.visibility })
        .eq('id', characterId),
      '캐릭터를 저장하지 못했어요.',
    )
  }

  // 2) 자유 항목: 지운 것 삭제 → 있던 것 수정 → 새 것 추가
  const keptIds = new Set(input.fields.filter((f) => f.id).map((f) => f.id))
  const removedFieldIds = (existing?.fields ?? []).map((f) => f.id).filter((id) => !keptIds.has(id))
  if (removedFieldIds.length > 0) {
    check(await supabase.from('character_fields').delete().in('id', removedFieldIds), '항목을 저장하지 못했어요.')
  }
  const rows = input.fields.map((f, i) => ({
    id: f.id,
    character_id: characterId,
    label: f.label,
    content: f.content,
    sort_order: i,
  }))
  const oldRows = rows.filter((r) => r.id)
  const newRows = rows.filter((r) => !r.id).map(({ id: _id, ...rest }) => rest)
  if (oldRows.length > 0) check(await supabase.from('character_fields').upsert(oldRows), '항목을 저장하지 못했어요.')
  if (newRows.length > 0) check(await supabase.from('character_fields').insert(newRows), '항목을 저장하지 못했어요.')

  // 3) 지운 이미지 삭제 (DB 행 + 파일)
  const keptImageIds = new Set(
    input.images.filter((d) => d.kind === 'existing').map((d) => (d.kind === 'existing' ? d.image.id : '')),
  )
  const removedImages = (existing?.images ?? []).filter((img) => !keptImageIds.has(img.id))
  if (removedImages.length > 0) {
    check(
      await supabase.from('character_images').delete().in('id', removedImages.map((img) => img.id)),
      '이미지를 삭제하지 못했어요.',
    )
    await removeMediaUrls(removedImages.flatMap((img) => [img.image_url, img.thumb_url]))
  }

  // 4) 새 이미지 올리기 (원본 1600px + 썸네일 400px) — 한 장씩
  const keyToImageId = new Map<string, string>()
  const newDrafts = input.images.filter((d) => d.kind === 'new')
  let done = 0
  for (const [index, draft] of input.images.entries()) {
    if (draft.kind === 'existing') {
      keyToImageId.set(draft.key, draft.image.id)
      continue
    }
    onProgress?.(`이미지 올리는 중… (${done + 1}/${newDrafts.length})`)
    const { imageUrl, thumbUrl } = await uploadImageWithThumb(
      draft.file,
      mediaPaths.characterImage(userId, wikiId, characterId),
    )
    const res = await supabase
      .from('character_images')
      .insert({ character_id: characterId, image_url: imageUrl, thumb_url: thumbUrl, sort_order: index })
      .select('id')
      .single()
    if (res.error) await removeMediaUrls([imageUrl, thumbUrl])
    const row = check(res, '이미지를 저장하지 못했어요.') as { id: string }
    keyToImageId.set(draft.key, row.id)
    done++
  }

  // 5) 있던 이미지 순서 저장 (바뀐 것만)
  const orderUpdates = input.images
    .map((d, index) => ({ d, index }))
    .filter(({ d, index }) => d.kind === 'existing' && d.image.sort_order !== index)
    .map(({ d, index }) =>
      supabase
        .from('character_images')
        .update({ sort_order: index })
        .eq('id', (d as Extract<ImageDraft, { kind: 'existing' }>).image.id),
    )
  for (const res of await Promise.all(orderUpdates)) check(res, '이미지 순서를 저장하지 못했어요.')

  // 6) 대표 이미지
  const coverId = input.coverKey ? keyToImageId.get(input.coverKey) ?? null : null
  if (coverId !== (existing?.character.cover_image_id ?? null)) {
    check(
      await supabase.from('characters').update({ cover_image_id: coverId }).eq('id', characterId),
      '대표 이미지를 저장하지 못했어요.',
    )
  }

  return characterId
}

/** 캐릭터 삭제 (항목·이미지·로그가 함께 지워지고 이미지 파일도 정리) */
export async function deleteCharacter(full: CharacterFull) {
  const id = full.character.id
  const logs = check(
    await supabase.from('character_logs').select('body').eq('character_id', id),
    '캐릭터를 삭제하지 못했어요.',
  ) as { body: string }[]
  check(await supabase.from('characters').delete().eq('id', id), '캐릭터를 삭제하지 못했어요.')
  await removeMediaUrls([
    ...full.images.flatMap((img) => [img.image_url, img.thumb_url]),
    ...logs.flatMap((l) => extractImageUrls(l.body)),
  ])
}
