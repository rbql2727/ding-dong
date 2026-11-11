-- =====================================================================
-- 6) 로그 본문 길이 제한 늘리기 (툴바 편집기)
--
--  로그 본문을 편집기 문서(JSON)로 저장하게 되면서, 같은 글이라도 글자 수가 늘어납니다.
--  (굵게·색·표 같은 꾸밈 정보가 함께 저장되기 때문)
--  5만 자 → 30만 자로 늘립니다. 여러 번 실행해도 안전합니다.
-- =====================================================================

alter table public.character_logs drop constraint if exists character_logs_body_check;
alter table public.character_logs
  add constraint character_logs_body_check check (char_length(body) <= 300000);
