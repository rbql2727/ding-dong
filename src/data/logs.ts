import { extractImageUrls } from '../lib/richText'
import { IMAGE_SIZE, mediaPaths, removeMediaUrls, uploadResizedImage } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { CharacterLog } from '../lib/types'
import { check, NotFoundError } from './db'

const LOG_COLUMNS = 'id, character_id, title, body, created_at, updated_at'

/** 캐릭터의 로그 목록 (최신순) */
export async function listLogs(characterId: string): Promise<CharacterLog[]> {
  return check(
    await supabase
      .from('character_logs')
      .select(LOG_COLUMNS)
      .eq('character_id', characterId)
      .order('created_at', { ascending: false }),
    '로그 목록을 불러오지 못했어요.',
  ) as CharacterLog[]
}

export async function getLog(id: string): Promise<CharacterLog> {
  const log = check(
    await supabase.from('character_logs').select(LOG_COLUMNS).eq('id', id).maybeSingle(),
    '로그를 불러오지 못했어요.',
  ) as CharacterLog | null
  if (!log) throw new NotFoundError('로그를 찾을 수 없어요. 지워졌거나 볼 권한이 없어요.')
  return log
}

export async function createLog(characterId: string, title: string, body: string): Promise<CharacterLog> {
  return check(
    await supabase.from('character_logs').insert({ character_id: characterId, title, body }).select(LOG_COLUMNS).single(),
    '로그를 저장하지 못했어요.',
  ) as CharacterLog
}

export async function updateLog(id: string, title: string, body: string): Promise<CharacterLog> {
  return check(
    await supabase.from('character_logs').update({ title, body }).eq('id', id).select(LOG_COLUMNS).single(),
    '로그를 저장하지 못했어요.',
  ) as CharacterLog
}

export async function deleteLog(log: CharacterLog) {
  check(await supabase.from('character_logs').delete().eq('id', log.id), '로그를 삭제하지 못했어요.')
  await removeMediaUrls(extractImageUrls(log.body))
}

/** 본문에 넣을 이미지 올리기 (긴 변 1600px 로 줄여서) */
export async function uploadLogImage(userId: string, wikiId: string, characterId: string, file: File) {
  return uploadResizedImage(file, mediaPaths.logImage(userId, wikiId, characterId), IMAGE_SIZE.original)
}
