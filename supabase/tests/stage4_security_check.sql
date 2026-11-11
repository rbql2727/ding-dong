-- =====================================================================
-- 4단계 보안 테스트 (Supabase SQL Editor 에서 실행)
--
--  사용법
--   1) 아래 두 이메일을 내 테스트 계정 2개로 바꿉니다. (A = 위키 주인, B = 다른 사람)
--   2) 전체 복사 → SQL Editor → Run
--   3) 결과 표의 "통과" 칸이 전부 true 면 성공. 테스트 데이터는 마지막에 자동 삭제됩니다.
--
--  시나리오 (B 입장)
--   (a) 비공개 위키를 못 읽는다
--   (b) 승인제 위키: 제목·표지만 보이고, 승인 전에는 내용을 못 읽는다
--   (c) 승인 후에는 읽는다
--   (d) 철회하면 다시 못 읽는다
--   + 링크 공개, 전체 공개, 비공개 캐릭터, 이미지 파일 권한, 로그인 안 한 사용자, 수정 금지
-- =====================================================================

drop table if exists t4_input, t4_result;
create temp table t4_input as
select
  (select id from auth.users where email = 'a@example.com') as a_id,   -- ← A (위키 주인) 이메일
  (select id from auth.users where email = 'b@example.com') as b_id;   -- ← B (다른 사람) 이메일
create temp table t4_result (no serial, 시나리오 text, 항목 text, 통과 boolean);
grant all on t4_input, t4_result to authenticated, anon;
grant usage on sequence t4_result_no_seq to authenticated, anon;

do $$
declare
  v_a uuid; v_b uuid;
  v_wiki uuid := gen_random_uuid();
  v_char uuid := gen_random_uuid();      -- 위키와 같은 공개 범위인 캐릭터
  v_secret uuid := gen_random_uuid();    -- 항상 비공개인 캐릭터
  v_token text; v_old_token text;
  p_cover text; p_img text; p_log_img text; p_secret_img text; p_avatar text;
  n int; ok boolean; v_status public.request_status;

begin
  select a_id, b_id into v_a, v_b from t4_input;
  if v_a is null or v_b is null then
    raise exception '이메일에 해당하는 계정을 찾지 못했어요. 맨 위의 이메일 두 개를 확인해 주세요.';
  end if;

  p_cover      := v_a || '/wikis/' || v_wiki || '/cover-test.webp';
  p_img        := v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/test.webp';
  p_log_img    := v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/logs/test.webp';
  p_secret_img := v_a || '/wikis/' || v_wiki || '/characters/' || v_secret || '/test.webp';
  p_avatar     := v_a || '/avatar/test.webp';

  -- ===================== A: 테스트 위키 만들기 (비공개) =====================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  insert into public.wikis (id, owner_id, name, description) values (v_wiki, v_a, '보안테스트위키', '비밀 소개글');
  insert into public.characters (id, wiki_id, name, visibility) values (v_char, v_wiki, '테스트캐릭', 'private');
  insert into public.characters (id, wiki_id, name, visibility) values (v_secret, v_wiki, '비밀캐릭', 'private');
  insert into public.character_fields (character_id, label, content) values (v_char, '성격', '비밀');
  insert into public.character_images (character_id, image_url, thumb_url) values (v_char,
    'https://abc.supabase.co/storage/v1/object/public/media/' || v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/0.webp',
    'https://abc.supabase.co/storage/v1/object/public/media/' || v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/0_thumb.webp');
  insert into public.character_logs (character_id, title, body) values (v_char, '테스트 로그', '비밀 본문');
  insert into public.character_logs (character_id, title, body) values (v_secret, '비밀캐릭 로그', '비밀');
  select public.get_share_token(v_wiki) into v_token;
  insert into t4_result (시나리오, 항목, 통과) values ('준비', 'A 는 공유 토큰을 가져올 수 있음', v_token is not null);

  -- ===================== (a) 비공개 =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', 'B 는 위키를 못 읽음', n = 0);
  select count(*) into n from public.characters where wiki_id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', 'B 는 캐릭터를 못 읽음', n = 0);
  select count(*) into n from public.character_logs where character_id in (v_char, v_secret);
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', 'B 는 로그를 못 읽음', n = 0);
  select count(*) into n from public.get_wiki_preview(v_wiki);
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', '미리보기도 안 나옴', n = 0);
  select count(*) into n from public.explore_wikis('', 50, 0) e where e.id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', '탐색 목록에 안 나옴', n = 0);
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', '표지 이미지 파일 못 봄', not private.can_view_media(p_cover));
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', '캐릭터 이미지 파일 못 봄', not private.can_view_media(p_img));
  ok := false;
  begin
    insert into public.access_requests (wiki_id, requester_id) values (v_wiki, v_b);
  exception when insufficient_privilege then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('(a) 비공개', '비공개 위키엔 열람 요청 불가', ok);

  -- ===================== (b) 승인제, 승인 전 =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  update public.wikis set visibility = 'approved' where id = v_wiki;
  update public.characters set visibility = 'approved' where id = v_char;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into n from public.explore_wikis('보안테스트', 50, 0) e
    where e.id = v_wiki and e.description is null and e.character_count is null and not e.can_view;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '탐색에 제목만 보이고 소개·캐릭터 수는 숨김', n = 1);
  select count(*) into n from public.get_wiki_preview(v_wiki) p where p.name = '보안테스트위키' and p.description is null;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '미리보기: 제목 보임, 소개 숨김', n = 1);
  select count(*) into n from public.explore_wikis('비밀 소개', 50, 0) e where e.id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '소개글로 검색해도 안 걸림', n = 0);
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '표지 이미지는 보임', private.can_view_media(p_cover));
  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '위키 내용을 못 읽음', n = 0);
  select count(*) into n from public.characters where wiki_id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '캐릭터를 못 읽음', n = 0);
  select count(*) into n from public.character_logs where character_id = v_char;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '로그를 못 읽음', n = 0);
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '캐릭터 이미지 파일 못 봄', not private.can_view_media(p_img));

  ok := false;
  begin
    insert into public.access_requests (wiki_id, requester_id, status) values (v_wiki, v_b, 'approved');
  exception when insufficient_privilege then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '스스로 승인된 요청은 못 만듦', ok);

  insert into public.access_requests (wiki_id, requester_id) values (v_wiki, v_b);
  ok := false;
  begin
    insert into public.access_requests (wiki_id, requester_id) values (v_wiki, v_b);
  exception when unique_violation then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', '열람 요청 중복 방지', ok);

  update public.access_requests set status = 'approved' where wiki_id = v_wiki and requester_id = v_b;
  select status into v_status from public.access_requests where wiki_id = v_wiki and requester_id = v_b;
  insert into t4_result (시나리오, 항목, 통과) values ('(b) 승인 전', 'B 는 자기 요청을 승인으로 못 바꿈', v_status = 'pending');

  -- ===================== (c) 승인 후 =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  update public.access_requests set status = 'approved' where wiki_id = v_wiki and requester_id = v_b;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '위키를 읽음', n = 1);
  select count(*) into n from public.characters where id = v_char;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '캐릭터를 읽음', n = 1);
  select count(*) into n from public.character_logs where character_id = v_char;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '로그를 읽음 (캐릭터 공개 범위를 따름)', n = 1);
  select count(*) into n from public.character_fields where character_id = v_char;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '항목을 읽음', n = 1);
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '캐릭터·로그 이미지 파일 봄',
    private.can_view_media(p_img) and private.can_view_media(p_log_img));
  select count(*) into n from public.characters where id = v_secret;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '비공개 캐릭터는 여전히 못 읽음', n = 0);
  select count(*) into n from public.character_logs where character_id = v_secret;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '비공개 캐릭터의 로그도 못 읽음', n = 0);
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '비공개 캐릭터 이미지 주소를 알아도 못 봄', not private.can_view_media(p_secret_img));

  update public.wikis set name = '해킹' where id = v_wiki;
  get diagnostics n = row_count;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '읽을 수는 있어도 위키 수정은 못 함', n = 0);
  update public.character_logs set body = '해킹' where character_id = v_char;
  get diagnostics n = row_count;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '로그 수정 못 함', n = 0);
  delete from public.characters where id = v_char;
  get diagnostics n = row_count;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '캐릭터 삭제 못 함', n = 0);
  ok := false;
  begin
    perform w.share_token from public.wikis w where w.id = v_wiki;
  exception when insufficient_privilege then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '공유 토큰 열은 읽을 수 없음', ok);
  insert into t4_result (시나리오, 항목, 통과) values ('(c) 승인 후', '공유 토큰 함수도 주인 아니면 빈 값', public.get_share_token(v_wiki) is null);

  -- ===================== (d) 철회 =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  update public.access_requests set status = 'rejected' where wiki_id = v_wiki and requester_id = v_b;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(d) 철회 후', '위키를 다시 못 읽음', n = 0);
  select count(*) into n from public.characters where wiki_id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('(d) 철회 후', '캐릭터를 다시 못 읽음', n = 0);
  select count(*) into n from public.character_logs where character_id = v_char;
  insert into t4_result (시나리오, 항목, 통과) values ('(d) 철회 후', '로그를 다시 못 읽음', n = 0);
  insert into t4_result (시나리오, 항목, 통과) values ('(d) 철회 후', '이미지 파일도 다시 못 봄', not private.can_view_media(p_img));

  -- ===================== 링크 공개 =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  update public.wikis set visibility = 'link' where id = v_wiki;
  update public.characters set visibility = 'link' where id = v_char;
  v_old_token := v_token;
  select public.get_share_token(v_wiki) into v_token;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '승인제→링크 전환 시 토큰 자동 교체', v_token <> v_old_token);

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '링크를 안 열었으면 못 읽음', n = 0);
  ok := false;
  begin
    perform public.redeem_share_token('틀린토큰');
  exception when raise_exception then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '틀린 토큰은 거부', ok);
  ok := false;
  begin
    perform public.redeem_share_token(v_old_token);
  exception when raise_exception then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '예전 토큰은 거부', ok);
  ok := false;
  begin
    insert into public.link_grants (wiki_id, user_id, share_token) values (v_wiki, v_b, 'x');
  exception when insufficient_privilege then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '열람 기록을 직접 만들 수 없음', ok);

  perform public.redeem_share_token(v_token);
  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '올바른 링크로 들어오면 읽음', n = 1);
  select count(*) into n from public.character_logs where character_id = v_char;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '로그도 읽음', n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.regenerate_share_token(v_wiki);

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('링크 공개', '링크를 새로 만들면 예전 열람자는 못 읽음', n = 0);

  -- ===================== 전체 공개 =====================
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  update public.wikis set visibility = 'public' where id = v_wiki;
  update public.characters set visibility = 'public' where id = v_char;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  select count(*) into n from public.wikis where id = v_wiki;
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '로그인한 사용자는 읽음', n = 1);
  select count(*) into n from public.explore_wikis('보안테스트', 50, 0) e where e.id = v_wiki and e.description = '비밀 소개글';
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '탐색에 소개까지 보임', n = 1);
  select count(*) into n from public.characters where id = v_secret;
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '비공개 캐릭터는 여전히 숨김', n = 0);
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '비공개 캐릭터 이미지 파일 못 봄', not private.can_view_media(p_secret_img));
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '프로필 사진은 로그인 사용자에게 보임', private.can_view_media(p_avatar));
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '이상한 경로는 거부',
    not private.can_view_media(v_a || '/wikis/' || v_wiki || '/characters/../x.webp')
    and not private.can_view_media(v_a || '/secret.webp'));

  -- 로그인 안 한 사용자
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  ok := false;
  begin
    perform 1 from public.wikis limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '로그인 안 하면 전체 공개 위키도 못 읽음', ok);
  ok := false;
  begin
    perform 1 from public.explore_wikis('', 10, 0);
  exception when insufficient_privilege then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('전체 공개', '로그인 안 하면 탐색도 불가', ok);

  -- ===================== 이미지 주소 칸 보호 (S1, 7번 마이그레이션) =====================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  ok := false;
  begin
    update public.profiles set avatar_url = 'https://evil.example/track.gif' where id = v_a;
  exception when check_violation then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('이미지 주소', '프로필 사진에 다른 사이트 주소 저장 불가', ok);
  ok := false;
  begin
    update public.profiles set avatar_url = 'https://abc.supabase.co/storage/v1/object/public/media/' || v_b || '/avatar/x.webp' where id = v_a;
  exception when check_violation then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('이미지 주소', '프로필 사진에 남의 폴더 주소 저장 불가', ok);
  ok := false;
  begin
    update public.wikis set cover_url = 'https://evil.example/c.png' where id = v_wiki;
  exception when check_violation then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('이미지 주소', '위키 표지에 다른 사이트 주소 저장 불가', ok);
  ok := false;
  begin
    insert into public.character_images (character_id, image_url, thumb_url)
    values (v_char, 'https://evil.example/a.png', 'https://evil.example/a.png');
  exception when check_violation then ok := true;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('이미지 주소', '캐릭터 이미지에 다른 사이트 주소 저장 불가', ok);
  ok := true;
  begin
    update public.wikis set cover_url = 'https://abc.supabase.co/storage/v1/object/public/media/' || v_a || '/wikis/' || v_wiki || '/cover-1.webp' where id = v_wiki;
    insert into public.character_images (character_id, image_url, thumb_url) values (v_char,
      'https://abc.supabase.co/storage/v1/object/public/media/' || v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/1.webp',
      'https://abc.supabase.co/storage/v1/object/public/media/' || v_a || '/wikis/' || v_wiki || '/characters/' || v_char || '/1_thumb.webp');
  exception when check_violation then ok := false;
  end;
  insert into t4_result (시나리오, 항목, 통과) values ('이미지 주소', '앱이 만드는 정상 주소는 저장됨', ok);

  -- ===================== 정리 =====================
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.wikis where id = v_wiki;
end $$;

select no, 시나리오, 항목, 통과 from t4_result order by no;
