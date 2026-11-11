-- =====================================================================
-- 계정 2개 권한 테스트 (Supabase SQL Editor 에서 실행)
--
--  사용법
--   1) 아래 두 줄의 이메일을 내가 만든 테스트 계정 2개로 바꿉니다.
--   2) 전체 복사 → SQL Editor 에 붙여넣기 → Run
--   3) 결과 표의 "통과" 칸이 전부 true 면 성공입니다.
--
--  하는 일: A 계정으로 비공개 위키를 만든 뒤, B 계정으로 보이는지/고칠 수 있는지 시험합니다.
--  테스트로 만든 데이터는 마지막에 자동으로 지워집니다 (DB에 아무것도 남지 않음).
-- =====================================================================

drop table if exists test_input, test_result;

create temp table test_input as
select
  (select id from auth.users where email = 'a@example.com') as a_id,   -- ← A 계정 이메일
  (select id from auth.users where email = 'b@example.com') as b_id;   -- ← B 계정 이메일

create temp table test_result (no int, 항목 text, 통과 boolean);
grant all on test_input, test_result to authenticated;

do $$
declare
  v_a uuid;
  v_b uuid;
  v_wiki uuid;
  v_n int;
begin
  select a_id, b_id into v_a, v_b from test_input;
  if v_a is null or v_b is null then
    raise exception '이메일에 해당하는 계정을 찾지 못했어요. 맨 위의 이메일 두 개를 확인해 주세요.';
  end if;

  insert into test_result values (1, 'A, B 모두 프로필이 자동 생성됨',
    (select count(*) from public.profiles where id in (v_a, v_b)) = 2);

  -- ===== A 로 로그인한 것처럼 =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  insert into public.wikis (name) values ('권한 테스트용 위키') returning id into v_wiki;
  insert into test_result values (2, 'A 는 자기 비공개 위키를 볼 수 있음',
    exists (select 1 from public.wikis where id = v_wiki));

  -- ===== B 로 로그인한 것처럼 =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  insert into test_result values (3, 'B 는 A 의 비공개 위키를 볼 수 없음',
    not exists (select 1 from public.wikis where id = v_wiki));

  update public.wikis set name = '해킹' where id = v_wiki;
  get diagnostics v_n = row_count;
  insert into test_result values (4, 'B 는 A 의 위키를 고칠 수 없음', v_n = 0);

  update public.profiles set nickname = '해킹' where id = v_a;
  get diagnostics v_n = row_count;
  insert into test_result values (5, 'B 는 A 의 닉네임을 바꿀 수 없음', v_n = 0);

  update public.profiles set nickname = nickname where id = v_b;
  get diagnostics v_n = row_count;
  insert into test_result values (6, 'B 는 자기 닉네임은 바꿀 수 있음', v_n = 1);

  insert into test_result values (7, 'B 도 A 의 닉네임은 볼 수 있음 (프로필은 공개)',
    exists (select 1 from public.profiles where id = v_a));

  -- ===== 원래 관리자 권한으로 돌아와서 테스트 데이터 정리 =====
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.wikis where id = v_wiki;
end $$;

select no, 항목, 통과 from test_result order by no;
