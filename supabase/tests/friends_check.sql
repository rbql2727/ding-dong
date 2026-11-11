-- =====================================================================
-- 친구 기능 보안 테스트 (Supabase SQL Editor 에서 실행)
--
--  사용법
--   1) 아래 이메일 세 개를 테스트 계정으로 바꿉니다.
--      A = 위키 주인, B = A 에게 친구 신청하는 사람, C = 상관없는 사람
--      (세 사람 사이에 이미 친구 관계가 있으면 테스트가 멈춥니다)
--   2) 전체 복사 → SQL Editor → Run
--   3) "통과" 칸이 전부 true 면 성공. 테스트 데이터는 마지막에 자동 삭제됩니다.
-- =====================================================================

drop table if exists tf_input, tf_result;
create temp table tf_input as
select
  (select id from auth.users where email = 'a@example.com') as a_id,   -- ← A (위키 주인)
  (select id from auth.users where email = 'b@example.com') as b_id,   -- ← B (친구 신청하는 사람)
  (select id from auth.users where email = 'c@example.com') as c_id;   -- ← C (상관없는 사람)
create temp table tf_result (no serial, 시나리오 text, 항목 text, 통과 boolean);
grant all on tf_input, tf_result to authenticated, anon;
grant usage on sequence tf_result_no_seq to authenticated, anon;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', case when p_uid is null then 'anon' else 'authenticated' end, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
end $$;

create or replace function pg_temp.ok(p_scene text, p_item text, p_pass boolean) returns void language sql as $$
  insert into tf_result (시나리오, 항목, 통과) values (p_scene, p_item, coalesce(p_pass, false));
$$;

do $$
declare
  v_a uuid; v_b uuid; v_c uuid;
  v_wiki uuid := gen_random_uuid();     -- 친구 공개 위키
  v_char uuid := gen_random_uuid();     -- 친구 공개 캐릭터
  v_pub uuid := gen_random_uuid();      -- 전체 공개 위키
  v_pubsecret uuid := gen_random_uuid();-- 전체 공개 위키 안의 비공개 캐릭터
  v_code text; v_req uuid; r text; n int; ok boolean;
  p_img text;
begin
  select a_id, b_id, c_id into v_a, v_b, v_c from tf_input;
  if v_a is null or v_b is null or v_c is null then
    raise exception '이메일에 해당하는 계정을 찾지 못했어요. 맨 위의 이메일 세 개를 확인해 주세요.';
  end if;
  if exists (select 1 from public.friendships f
             where f.requester_id in (v_a, v_b, v_c) and f.addressee_id in (v_a, v_b, v_c)) then
    raise exception '세 계정 사이에 이미 친구 관계가 있어요. 다른 테스트 계정을 써 주세요.';
  end if;
  p_img := v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/test.webp';

  -- ===================== A: 위키 준비 =====================
  perform pg_temp.as_user(v_a);
  insert into public.wikis (id, owner_id, name, description, visibility) values (v_wiki, v_a, '친구테스트위키', '친구만 보는 소개', 'friends');
  insert into public.characters (id, wiki_id, name, visibility) values (v_char, v_wiki, '친구캐릭', 'friends');
  insert into public.character_logs (character_id, title, body) values (v_char, '친구테스트로그', '본문');
  insert into public.wikis (id, owner_id, name, visibility) values (v_pub, v_a, '공개테스트위키', 'public');
  insert into public.characters (id, wiki_id, name, visibility) values (v_pubsecret, v_pub, '숨은캐릭이름', 'private');

  -- 고유코드
  select friend_code into v_code from public.profiles where id = v_a;
  perform pg_temp.ok('고유코드', '코드가 8자리 대문자·숫자', v_code ~ '^[A-Z0-9]{8}$');
  update public.profiles set friend_code = 'AAAAAAAA' where id = v_a;
  perform pg_temp.ok('고유코드', '본인도 코드를 바꿀 수 없음', (select friend_code from public.profiles where id = v_a) = v_code);

  -- ===================== B: 친구 되기 전 =====================
  perform pg_temp.as_user(v_b);
  perform pg_temp.ok('친구 전', '친구 공개 위키 못 읽음', not exists (select 1 from public.wikis where id = v_wiki));
  perform pg_temp.ok('친구 전', '친구 공개 캐릭터·로그 못 읽음',
    not exists (select 1 from public.characters where id = v_char) and not exists (select 1 from public.character_logs where character_id = v_char));
  perform pg_temp.ok('친구 전', '캐릭터 이미지 파일 못 읽음', not private.can_view_media(p_img));
  perform pg_temp.ok('친구 전', '탐색에 친구 공개 위키 안 보임', not exists (select 1 from public.explore_wikis('', 50, 0) where id = v_wiki));
  perform pg_temp.ok('친구 전', '홈 소식에 A 로그 없음', not exists (select 1 from public.home_feed(50) where character_id = v_char));
  perform pg_temp.ok('계정 검색', '고유코드로 A 찾기', exists (select 1 from public.search_profiles(lower(v_code)) where id = v_a));
  perform pg_temp.ok('계정 검색', '# 붙여도 찾기', exists (select 1 from public.search_profiles('#' || v_code) where id = v_a));

  -- 직접 추가 불가 (신청은 함수로만)
  ok := false;
  begin
    insert into public.friendships (requester_id, addressee_id, status) values (v_b, v_a, 'accepted');
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.ok('신청', '친구 관계를 직접 만들 수 없음', ok);
  ok := false;
  begin
    perform public.send_friend_request(v_b);
  exception when others then ok := true;
  end;
  perform pg_temp.ok('신청', '나 자신에게 신청 불가', ok);

  r := public.send_friend_request(v_a);
  perform pg_temp.ok('신청', 'B → A 신청하면 sent', r = 'sent');
  perform pg_temp.ok('신청', '다시 눌러도 그대로 sent', public.send_friend_request(v_a) = 'sent');
  select id into v_req from public.friendships where requester_id = v_b and addressee_id = v_a;
  update public.friendships set status = 'accepted' where id = v_req;
  perform pg_temp.ok('신청', 'B 는 자기 신청을 수락할 수 없음', (select status from public.friendships where id = v_req) = 'pending');
  perform pg_temp.ok('신청', '수락 전에는 여전히 못 읽음', not exists (select 1 from public.wikis where id = v_wiki));

  -- C 는 남의 신청을 못 봄
  perform pg_temp.as_user(v_c);
  perform pg_temp.ok('신청', 'C 는 B·A 의 신청을 못 봄', not exists (select 1 from public.friendships where id = v_req));
  update public.friendships set status = 'accepted' where id = v_req;
  delete from public.friendships where id = v_req;
  perform pg_temp.as_user(v_a);
  perform pg_temp.ok('신청', 'C 는 남의 신청을 수락·삭제 못 함', (select status from public.friendships where id = v_req) = 'pending');

  -- ===================== A: 수락 =====================
  ok := false;
  begin
    update public.friendships set requester_id = v_c where id = v_req;
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.ok('수락', '신청한 사람은 바꿀 수 없음', ok);
  update public.friendships set status = 'accepted' where id = v_req;
  perform pg_temp.ok('수락', 'A 가 수락하면 accepted', (select status from public.friendships where id = v_req) = 'accepted');

  -- ===================== B: 친구가 된 뒤 =====================
  perform pg_temp.as_user(v_b);
  perform pg_temp.ok('친구 후', '친구 공개 위키·캐릭터·로그 읽음',
    exists (select 1 from public.wikis where id = v_wiki) and exists (select 1 from public.characters where id = v_char)
    and exists (select 1 from public.character_logs where character_id = v_char));
  perform pg_temp.ok('친구 후', '캐릭터 이미지 파일 읽음', private.can_view_media(p_img));
  perform pg_temp.ok('친구 후', '홈 소식에 A 로그 보임', exists (select 1 from public.home_feed(50) where character_id = v_char));
  perform pg_temp.ok('친구 후', '탐색에서 캐릭터 이름으로 찾기',
    exists (select 1 from public.explore_wikis('친구캐', 50, 0) where id = v_wiki and '친구캐릭' = any(matched_characters)));
  perform pg_temp.ok('친구 후', 'A 프로필의 위키 목록에 보임', exists (select 1 from public.explore_wikis('', 50, 0, v_a) where id = v_wiki));
  perform pg_temp.ok('친구 후', '비공개 캐릭터 이름으로는 못 찾음', not exists (select 1 from public.explore_wikis('숨은캐릭', 50, 0)));
  perform pg_temp.ok('친구 후', '관계가 friends 로 보임', (select friend_status from public.search_profiles(v_code) where id = v_a) = 'friends');

  -- ===================== C: 상관없는 사람 =====================
  perform pg_temp.as_user(v_c);
  perform pg_temp.ok('남', '친구 공개 위키·로그 못 읽음',
    not exists (select 1 from public.wikis where id = v_wiki) and not exists (select 1 from public.character_logs where character_id = v_char));
  perform pg_temp.ok('남', '캐릭터 이미지 파일 못 읽음', not private.can_view_media(p_img));
  perform pg_temp.ok('남', '홈 소식에 A 로그 없음', not exists (select 1 from public.home_feed(50) where character_id = v_char));
  perform pg_temp.ok('남', '탐색·검색에 친구 공개 위키 없음',
    not exists (select 1 from public.explore_wikis('', 50, 0) where id = v_wiki)
    and not exists (select 1 from public.explore_wikis('친구', 50, 0) where id = v_wiki)
    and not exists (select 1 from public.explore_wikis('', 50, 0, v_a) where id = v_wiki));
  perform pg_temp.ok('남', '전체 공개 위키는 보임', exists (select 1 from public.explore_wikis('공개테스트', 50, 0) where id = v_pub));

  -- ===================== 친구 끊기 =====================
  perform pg_temp.as_user(v_b);
  delete from public.friendships where id = v_req;
  perform pg_temp.ok('끊기', '끊으면 다시 못 읽음',
    not exists (select 1 from public.wikis where id = v_wiki) and not exists (select 1 from public.home_feed(50) where character_id = v_char));

  -- ===================== 로그인 안 한 사용자 =====================
  perform pg_temp.as_user(null);
  ok := false;
  begin
    perform * from public.home_feed(5);
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.ok('비로그인', '홈 소식 함수 못 부름', ok);
  ok := false;
  begin
    perform * from public.search_profiles('a');
  exception when insufficient_privilege then ok := true;
  end;
  perform pg_temp.ok('비로그인', '계정 검색 함수 못 부름', ok);

  -- ===================== 정리 =====================
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.friendships where id = v_req;
  delete from public.wikis where id in (v_wiki, v_pub);
end $$;

select no, 시나리오, 항목, 통과 from tf_result order by no;
