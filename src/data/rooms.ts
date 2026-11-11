import { supabase } from '../lib/supabase'
import type { Room } from '../lib/types'
import { check } from './db'

const ROOM_COLUMNS = 'id, wiki_id, name, sort_order'

export async function listRooms(wikiId: string): Promise<Room[]> {
  return check(
    await supabase
      .from('rooms')
      .select(ROOM_COLUMNS)
      .eq('wiki_id', wikiId)
      .order('sort_order')
      .order('created_at'),
    '방 목록을 불러오지 못했어요.',
  ) as Room[]
}

export async function createRoom(wikiId: string, name: string, sortOrder: number): Promise<Room> {
  return check(
    await supabase.from('rooms').insert({ wiki_id: wikiId, name, sort_order: sortOrder }).select(ROOM_COLUMNS).single(),
    '방을 만들지 못했어요.',
  ) as Room
}

export async function renameRoom(id: string, name: string) {
  check(await supabase.from('rooms').update({ name }).eq('id', id), '방 이름을 바꾸지 못했어요.')
}

/** 방 삭제 — 안에 있던 캐릭터는 지워지지 않고 "분류 없음"으로 옮겨짐 (DB 설정) */
export async function deleteRoom(id: string) {
  check(await supabase.from('rooms').delete().eq('id', id), '방을 삭제하지 못했어요.')
}

/** 방 순서 저장 — 주어진 순서대로 sort_order 를 0,1,2… 로 다시 매김 (바뀐 것만 저장) */
export async function saveRoomOrder(rooms: Room[]) {
  const changed = rooms
    .map((r, i) => ({ room: r, index: i }))
    .filter(({ room, index }) => room.sort_order !== index)
  const results = await Promise.all(
    changed.map(({ room, index }) => supabase.from('rooms').update({ sort_order: index }).eq('id', room.id)),
  )
  for (const res of results) check(res, '방 순서를 저장하지 못했어요.')
}
