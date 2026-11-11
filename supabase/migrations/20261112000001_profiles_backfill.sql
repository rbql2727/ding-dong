-- =====================================================================
-- 4) 프로필 보충 (2단계)
--
--  가입하면 profiles 행을 자동으로 만드는 트리거(on_auth_user_created)는
--  1번 파일(20261111000001_tables.sql)에 이미 있습니다.
--  이 파일은 "트리거를 만들기 전에 가입한 계정"이 있을 경우를 위해
--  프로필이 없는 계정에 프로필을 채워 줍니다. 여러 번 실행해도 안전합니다.
-- =====================================================================

insert into public.profiles (id, nickname)
select
  u.id,
  left(coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'nickname'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    '새 사용자'
  ), 30)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
