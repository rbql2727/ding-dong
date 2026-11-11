-- =====================================================================
-- 3) 이미지 저장소 (Supabase Storage)
--
--  버킷 이름: media (공개 버킷)
--  파일 경로 규칙: {내 user id}/{아무 폴더}/{무작위 파일명}
--    예) 3f2a.../characters/9c1b.../a8d7e6....webp
--
--  - 업로드/수정/삭제: 경로 첫 폴더가 "내 user id" 인 파일만 가능 (서버에서 막음)
--  - 보기: 공개 URL 로 바로 열림 (빠른 로딩·캐시를 위해)
--    파일명은 추측할 수 없는 무작위 값이고, 이미지 주소 자체는
--    RLS 로 보호되는 테이블(character_images 등)에만 저장되므로
--    볼 권한이 없는 사람은 주소를 알 수 없습니다.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "media: 내 폴더 파일 목록 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: 내 폴더에만 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: 내 폴더 파일만 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: 내 폴더 파일만 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
