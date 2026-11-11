-- =====================================================================
-- 2) 권한 설정 (Row Level Security)
--    "누가 어떤 행을 읽고/쓸 수 있는지"를 DB 서버에서 직접 막습니다.
--    앱에서 버튼을 숨기는 것과 별개로, 여기서 막히면 API로도 절대 못 봅니다.
--
--  규칙 요약
--   - 위키/방/캐릭터/항목/이미지/로그를 만들고 고치고 지우는 건 위키 주인만.
--   - 읽기는 공개 범위에 따라:
--       private  : 주인만
--       link     : 주인 + 공유 링크 토큰을 가진 사람 (x-share-token 헤더)
--       approved : 주인 + 열람 요청이 "승인"된 사람
--       public   : 누구나 (로그인 안 해도)
--   - 캐릭터는 "위키 공개 범위"와 "캐릭터 공개 범위"를 둘 다 통과해야 보입니다.
--   - 열람 요청은 공개 범위가 approved 인 남의 위키에만 보낼 수 있고,
--     승인/거절/철회는 위키 주인만 합니다.
-- =====================================================================

-- 권한 검사용 함수는 API에 노출되지 않는 private 스키마에 둡니다.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- 링크 공개용: 요청 헤더 x-share-token 값을 읽음 (없으면 null)
create function private.request_share_token()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json) ->> 'x-share-token',
    ''
  );
$$;

-- 현재 사용자가 이 위키의 주인인가?
create function private.is_wiki_owner(p_wiki_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wikis w
    where w.id = p_wiki_id and w.owner_id = auth.uid()
  );
$$;

-- 이 공개 범위(p_level)가 현재 사용자에게 이 위키 안에서 열려 있는가? (주인 여부는 따로 검사)
create function private.level_allows(p_level public.visibility_level, p_wiki_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_level
    when 'public' then true
    when 'link' then exists (
      select 1 from public.wikis w
      where w.id = p_wiki_id
        and w.share_token = private.request_share_token()
    )
    when 'approved' then auth.uid() is not null and exists (
      select 1 from public.access_requests r
      where r.wiki_id = p_wiki_id
        and r.requester_id = auth.uid()
        and r.status = 'approved'
    )
    else false
  end;
$$;

-- 현재 사용자가 이 위키를 볼 수 있는가?
create function private.can_view_wiki(p_wiki_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select w.owner_id = auth.uid() or private.level_allows(w.visibility, w.id)
    from public.wikis w
    where w.id = p_wiki_id
  ), false);
$$;

-- 현재 사용자가 이 캐릭터의 주인(=위키 주인)인가?
create function private.is_character_owner(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.characters c
    join public.wikis w on w.id = c.wiki_id
    where c.id = p_character_id and w.owner_id = auth.uid()
  );
$$;

-- 현재 사용자가 이 캐릭터를 볼 수 있는가? (위키 공개 범위 + 캐릭터 공개 범위 모두 통과)
create function private.can_view_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select w.owner_id = auth.uid()
        or (private.level_allows(w.visibility, w.id) and private.level_allows(c.visibility, w.id))
    from public.characters c
    join public.wikis w on w.id = c.wiki_id
    where c.id = p_character_id
  ), false);
$$;

-- 현재 사용자가 이 위키에 열람 요청을 보낼 수 있는가?
create function private.can_request_access(p_wiki_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.wikis w
    where w.id = p_wiki_id
      and w.visibility = 'approved'
      and w.owner_id <> auth.uid()
  );
$$;

grant execute on all functions in schema private to anon, authenticated;

-- =====================================================================
-- 테이블 접근 권한 (실제 행 단위 제한은 아래 RLS 정책이 함)
-- =====================================================================
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles          enable row level security;
alter table public.wikis             enable row level security;
alter table public.rooms             enable row level security;
alter table public.characters        enable row level security;
alter table public.character_fields  enable row level security;
alter table public.character_images  enable row level security;
alter table public.character_logs    enable row level security;
alter table public.access_requests   enable row level security;

-- ---------------------------------------------------------------------
-- profiles: 닉네임/아바타는 누구나 볼 수 있음, 수정은 본인만
-- (행 생성은 회원가입 트리거가 담당)
-- ---------------------------------------------------------------------
create policy "프로필은 누구나 조회" on public.profiles
  for select to anon, authenticated using (true);

create policy "본인 프로필만 수정" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- wikis
-- ---------------------------------------------------------------------
create policy "볼 수 있는 위키만 조회" on public.wikis
  for select to anon, authenticated
  using (owner_id = (select auth.uid()) or private.level_allows(visibility, id));

create policy "본인 위키만 생성" on public.wikis
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "본인 위키만 수정" on public.wikis
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "본인 위키만 삭제" on public.wikis
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------
create policy "볼 수 있는 위키의 방만 조회" on public.rooms
  for select to anon, authenticated
  using (private.can_view_wiki(wiki_id));

create policy "위키 주인만 방 생성" on public.rooms
  for insert to authenticated
  with check (private.is_wiki_owner(wiki_id));

create policy "위키 주인만 방 수정" on public.rooms
  for update to authenticated
  using (private.is_wiki_owner(wiki_id))
  with check (private.is_wiki_owner(wiki_id));

create policy "위키 주인만 방 삭제" on public.rooms
  for delete to authenticated
  using (private.is_wiki_owner(wiki_id));

-- ---------------------------------------------------------------------
-- characters
-- ---------------------------------------------------------------------
create policy "볼 수 있는 캐릭터만 조회" on public.characters
  for select to anon, authenticated
  using (private.can_view_character(id));

create policy "위키 주인만 캐릭터 생성" on public.characters
  for insert to authenticated
  with check (private.is_wiki_owner(wiki_id));

create policy "위키 주인만 캐릭터 수정" on public.characters
  for update to authenticated
  using (private.is_wiki_owner(wiki_id))
  with check (private.is_wiki_owner(wiki_id));

create policy "위키 주인만 캐릭터 삭제" on public.characters
  for delete to authenticated
  using (private.is_wiki_owner(wiki_id));

-- ---------------------------------------------------------------------
-- character_fields / character_images / character_logs
--   읽기: 캐릭터를 볼 수 있으면 / 쓰기: 캐릭터 주인만
-- ---------------------------------------------------------------------
create policy "볼 수 있는 캐릭터의 항목만 조회" on public.character_fields
  for select to anon, authenticated using (private.can_view_character(character_id));
create policy "캐릭터 주인만 항목 생성" on public.character_fields
  for insert to authenticated with check (private.is_character_owner(character_id));
create policy "캐릭터 주인만 항목 수정" on public.character_fields
  for update to authenticated
  using (private.is_character_owner(character_id))
  with check (private.is_character_owner(character_id));
create policy "캐릭터 주인만 항목 삭제" on public.character_fields
  for delete to authenticated using (private.is_character_owner(character_id));

create policy "볼 수 있는 캐릭터의 이미지만 조회" on public.character_images
  for select to anon, authenticated using (private.can_view_character(character_id));
create policy "캐릭터 주인만 이미지 생성" on public.character_images
  for insert to authenticated with check (private.is_character_owner(character_id));
create policy "캐릭터 주인만 이미지 수정" on public.character_images
  for update to authenticated
  using (private.is_character_owner(character_id))
  with check (private.is_character_owner(character_id));
create policy "캐릭터 주인만 이미지 삭제" on public.character_images
  for delete to authenticated using (private.is_character_owner(character_id));

create policy "볼 수 있는 캐릭터의 로그만 조회" on public.character_logs
  for select to anon, authenticated using (private.can_view_character(character_id));
create policy "캐릭터 주인만 로그 생성" on public.character_logs
  for insert to authenticated with check (private.is_character_owner(character_id));
create policy "캐릭터 주인만 로그 수정" on public.character_logs
  for update to authenticated
  using (private.is_character_owner(character_id))
  with check (private.is_character_owner(character_id));
create policy "캐릭터 주인만 로그 삭제" on public.character_logs
  for delete to authenticated using (private.is_character_owner(character_id));

-- ---------------------------------------------------------------------
-- access_requests
-- ---------------------------------------------------------------------
create policy "요청자 본인과 위키 주인만 요청 조회" on public.access_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or private.is_wiki_owner(wiki_id));

-- 요청은 "대기" 상태로만 만들 수 있음 (스스로 승인 불가)
create policy "승인제 위키에만 열람 요청" on public.access_requests
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and private.can_request_access(wiki_id)
  );

-- 승인 / 거절 / 철회(=rejected 로 변경)는 위키 주인만
create policy "위키 주인만 요청 상태 변경" on public.access_requests
  for update to authenticated
  using (private.is_wiki_owner(wiki_id))
  with check (private.is_wiki_owner(wiki_id));

-- 요청자는 자기 요청을 취소(삭제)할 수 있고, 주인은 요청을 지워 철회할 수 있음
create policy "요청자 또는 위키 주인만 요청 삭제" on public.access_requests
  for delete to authenticated
  using (requester_id = (select auth.uid()) or private.is_wiki_owner(wiki_id));

-- =====================================================================
-- 앱에서 호출하는 함수 (RPC)
-- =====================================================================

-- 승인제 위키 "미리보기": 아직 승인 전인 사람도 위키 이름/소개는 보고 요청할 수 있게.
-- 비공개·링크 공개 위키는 (주인이 아니면) 아무것도 돌려주지 않습니다.
create function public.get_wiki_preview(p_wiki_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  cover_url text,
  theme_color text,
  visibility public.visibility_level,
  owner_id uuid,
  owner_nickname text,
  can_view boolean,
  my_request_status public.request_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.id, w.name, w.description, w.cover_url, w.theme_color, w.visibility,
    w.owner_id, p.nickname,
    private.can_view_wiki(w.id),
    (select r.status from public.access_requests r
      where r.wiki_id = w.id and r.requester_id = auth.uid())
  from public.wikis w
  join public.profiles p on p.id = w.owner_id
  where w.id = p_wiki_id
    and (w.visibility in ('approved', 'public') or private.can_view_wiki(w.id));
$$;

-- 공유 링크 토큰 새로 만들기 (예전 링크는 더 이상 작동하지 않음). 위키 주인만.
create function public.regenerate_share_token(p_wiki_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  update public.wikis
     set share_token = v_token
   where id = p_wiki_id and owner_id = auth.uid();
  if not found then
    raise exception '위키 주인만 공유 링크를 바꿀 수 있습니다.';
  end if;
  return v_token;
end;
$$;

revoke execute on function public.get_wiki_preview(uuid) from public;
revoke execute on function public.regenerate_share_token(uuid) from public;
grant execute on function public.get_wiki_preview(uuid) to anon, authenticated;
grant execute on function public.regenerate_share_token(uuid) to authenticated;

-- 트리거 전용 함수는 API로 직접 호출하지 못하게
revoke execute on function public.handle_new_user() from public, anon, authenticated;
