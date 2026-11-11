-- =====================================================================
-- 7) 이미지 주소 칸 보호 (보안 점검 S1)
--
--  문제: 프로필 사진·위키 표지·캐릭터 이미지 주소 칸은 아무 글자나 받았음.
--        앱을 거치지 않고 다른 사이트 주소(추적용 이미지 등)를 넣으면,
--        그걸 보는 사람의 IP 가 그 사이트로 새어 나갈 수 있었음.
--  해결: 우리 Supabase Storage(media 버킷) 주소이면서 "자기 폴더"인 것만 저장되게 막음.
--        (화면 쪽에서도 우리 Storage 주소가 아니면 아예 불러오지 않도록 함 — 이중 잠금)
--
--  허용 형식
--    profiles.avatar_url            https://<프로젝트>.supabase.co/storage/v1/object/public/media/{내 id}/...
--    wikis.cover_url                .../media/{위키 주인 id}/wikis/{위키 id}/...
--    character_images.image_url     .../media/{아무 id}/wikis/{아무 id}/characters/{이 캐릭터 id}/...
--    character_images.thumb_url     (위와 같음)
--     ※ 캐릭터 이미지의 주인 폴더 확인은 Storage 정책(can_view_media)이 이미 함
--  비워 두기(null)는 프로필 사진·표지만 허용 (원래대로).
--
--  여러 번 실행해도 안전합니다.
--  예전에 이미 들어간 이상한 값이 있어도 이 파일은 실패하지 않습니다 (새로 저장하는 값부터 막고,
--  예전 값은 화면에서 표시하지 않음). 예전 값까지 검사한 결과는 실행 후 메시지(NOTICE)로 알려 줍니다.
-- =====================================================================

-- "우리 Storage media 버킷 주소" 앞부분
create or replace function private.media_url_prefix_ok(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/media/'
     and position('..' in p_url) = 0
     and p_url !~ '[\s"''<>]';
$$;

alter table public.profiles drop constraint if exists profiles_avatar_url_media_check;
alter table public.profiles
  add constraint profiles_avatar_url_media_check check (
    avatar_url is null
    or (private.media_url_prefix_ok(avatar_url) and position('/media/' || id::text || '/avatar/' in avatar_url) > 0)
  ) not valid;

alter table public.wikis drop constraint if exists wikis_cover_url_media_check;
alter table public.wikis
  add constraint wikis_cover_url_media_check check (
    cover_url is null
    or (
      private.media_url_prefix_ok(cover_url)
      and position('/media/' || owner_id::text || '/wikis/' || id::text || '/' in cover_url) > 0
    )
  ) not valid;

alter table public.character_images drop constraint if exists character_images_url_media_check;
alter table public.character_images
  add constraint character_images_url_media_check check (
    private.media_url_prefix_ok(image_url)
    and private.media_url_prefix_ok(thumb_url)
    and position('/characters/' || character_id::text || '/' in image_url) > 0
    and position('/characters/' || character_id::text || '/' in thumb_url) > 0
  ) not valid;

-- 예전 값도 규칙에 맞는지 검사 (맞으면 "완전 적용", 아니면 안내만)
do $$
declare
  c text;
begin
  foreach c in array array[
    'public.profiles:profiles_avatar_url_media_check',
    'public.wikis:wikis_cover_url_media_check',
    'public.character_images:character_images_url_media_check'
  ] loop
    begin
      execute format('alter table %s validate constraint %I', split_part(c, ':', 1), split_part(c, ':', 2));
      raise notice '확인 완료: % (예전 값도 모두 정상)', split_part(c, ':', 2);
    exception when check_violation then
      raise notice '주의: % — 예전 값 중 규칙에 안 맞는 주소가 있어요. 새로 저장하는 값은 막히고, 화면에서는 표시되지 않습니다.', split_part(c, ':', 2);
    end;
  end loop;
end $$;
