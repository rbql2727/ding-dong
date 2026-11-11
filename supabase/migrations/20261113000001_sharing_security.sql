-- =====================================================================
-- 5) 공개 범위 · 승인 · 이미지 보호 (4단계)
--
--  바뀌는 규칙
--   private  : 주인만
--   link     : 주인 + 공유 링크로 들어온 "로그인 사용자"
--              (링크를 열면 redeem_share_token 이 link_grants 에 기록 → 그 뒤로 열람 가능)
--              링크를 새로 만들면(토큰 교체) 예전 링크로 들어온 사람은 모두 다시 못 봄
--   approved : 주인 + 열람 요청이 승인된 사용자. 탐색 목록에는 제목·표지만 보임
--   public   : 로그인한 모든 사용자 (로그인 안 하면 아무것도 못 봄)
--   수정·삭제는 언제나 주인만. 로그·항목·이미지는 소속 캐릭터의 공개 범위를 따름.
--
--  이미지 파일
--   media 버킷을 "비공개"로 바꾸고, 파일 경로를 보고 볼 권한을 판단합니다.
--   앱은 짧게 유효한 서명 주소(signed URL)로만 이미지를 보여 줍니다.
--   → 비공개 캐릭터의 이미지 주소를 알아도 열리지 않습니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 로그인 안 한 사용자(anon)는 아무것도 못 보게
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke usage on schema private from anon;

alter policy "프로필은 누구나 조회" on public.profiles to authenticated;
alter policy "볼 수 있는 위키만 조회" on public.wikis to authenticated;
alter policy "볼 수 있는 위키의 방만 조회" on public.rooms to authenticated;
alter policy "볼 수 있는 캐릭터만 조회" on public.characters to authenticated;
alter policy "볼 수 있는 캐릭터의 항목만 조회" on public.character_fields to authenticated;
alter policy "볼 수 있는 캐릭터의 이미지만 조회" on public.character_images to authenticated;
alter policy "볼 수 있는 캐릭터의 로그만 조회" on public.character_logs to authenticated;

-- ---------------------------------------------------------------------
-- 2) 공유 토큰은 주인만 볼 수 있게 (열 단위 권한)
--    share_token 을 뺀 나머지 열만 읽기 허용. 주인은 get_share_token() 으로 가져감.
-- ---------------------------------------------------------------------
revoke select on public.wikis from authenticated;
grant select (id, owner_id, name, description, cover_url, theme_color, visibility, created_at)
  on public.wikis to authenticated;

-- ---------------------------------------------------------------------
-- 3) 링크 열람 기록
-- ---------------------------------------------------------------------
create table public.link_grants (
  wiki_id      uuid not null references public.wikis (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  -- 들어올 때 쓴 토큰. 위키의 현재 토큰과 같을 때만 유효 (링크 재발급 = 전원 무효)
  share_token  text not null,
  created_at   timestamptz not null default now(),
  primary key (wiki_id, user_id)
);
create index link_grants_user_idx on public.link_grants (user_id);

alter table public.link_grants enable row level security;
revoke all on public.link_grants from anon;
grant select, delete on public.link_grants to authenticated; -- 추가는 redeem_share_token() 으로만

create policy "본인 기록 또는 위키 주인만 조회" on public.link_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_wiki_owner(wiki_id));

create policy "본인 또는 위키 주인만 삭제" on public.link_grants
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_wiki_owner(wiki_id));

-- ---------------------------------------------------------------------
-- 4) 공개 범위 판단 함수 교체
-- ---------------------------------------------------------------------
create or replace function private.level_allows(p_level public.visibility_level, p_wiki_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and case p_level
    when 'public' then true
    when 'link' then exists (
      select 1
      from public.link_grants g
      join public.wikis w on w.id = g.wiki_id
      where g.wiki_id = p_wiki_id
        and g.user_id = auth.uid()
        and g.share_token = w.share_token
    )
    when 'approved' then exists (
      select 1 from public.access_requests r
      where r.wiki_id = p_wiki_id
        and r.requester_id = auth.uid()
        and r.status = 'approved'
    )
    else false
  end;
$$;

-- 헤더 방식 링크 공개는 더 이상 쓰지 않음
drop function if exists private.request_share_token();

-- ---------------------------------------------------------------------
-- 5) 이미지 파일 권한 판단
--   경로 규칙 (lib/storage.ts 와 같아야 함)
--     {uid}/avatar/*                                   로그인 사용자 누구나
--     {uid}/wikis/{wikiId}/cover-*                     위키를 볼 수 있거나, 승인제·전체 공개 위키면 로그인 사용자 누구나 (탐색 목록 표지)
--     {uid}/wikis/{wikiId}/characters/{charId}/...     그 캐릭터를 볼 수 있는 사람 (로그 이미지 포함)
--     그 밖의 경로                                      파일 주인만
--   {uid} 폴더 주인과 위키 주인이 다르거나, 캐릭터가 그 위키 소속이 아니면 거부.
-- ---------------------------------------------------------------------
create function private.can_view_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts  text[] := string_to_array(p_name, '/');
  n      int    := coalesce(array_length(parts, 1), 0);
  v_owner uuid;
  v_wiki  uuid;
  v_char  uuid;
begin
  if auth.uid() is null or n < 2 then
    return false;
  end if;

  -- 내 파일은 언제나
  if parts[1] = auth.uid()::text then
    return true;
  end if;

  -- 프로필 사진
  if parts[2] = 'avatar' and n = 3 then
    return true;
  end if;

  if parts[2] <> 'wikis' or n < 4 then
    return false;
  end if;

  begin
    v_owner := parts[1]::uuid;
    v_wiki  := parts[3]::uuid;
  exception when others then
    return false;
  end;

  if not exists (select 1 from public.wikis w where w.id = v_wiki and w.owner_id = v_owner) then
    return false;
  end if;

  -- 위키 표지
  if n = 4 and parts[4] like 'cover-%' then
    return private.can_view_wiki(v_wiki)
        or exists (select 1 from public.wikis w where w.id = v_wiki and w.visibility in ('approved', 'public'));
  end if;

  -- 캐릭터 이미지 / 로그 이미지
  if n >= 6 and parts[4] = 'characters' then
    begin
      v_char := parts[5]::uuid;
    exception when others then
      return false;
    end;
    if not exists (select 1 from public.characters c where c.id = v_char and c.wiki_id = v_wiki) then
      return false;
    end if;
    return private.can_view_character(v_char);
  end if;

  return false;
end;
$$;

grant execute on function private.can_view_media(text) to authenticated;

-- 버킷을 비공개로 → 공개 주소(/object/public/...)로는 더 이상 열리지 않음
update storage.buckets set public = false where id = 'media';

drop policy if exists "media: 내 폴더 파일 목록 조회" on storage.objects;
create policy "media: 볼 권한이 있는 파일만 읽기" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and private.can_view_media(name));

-- ---------------------------------------------------------------------
-- 6) 앱에서 부르는 함수 (RPC)
-- ---------------------------------------------------------------------

-- 위키 미리보기: 승인제·전체 공개 위키는 제목·표지·주인 닉네임까지.
-- 소개(description)는 볼 권한이 있을 때만. 비공개·링크 위키는 권한이 없으면 아무것도 안 돌려줌.
create or replace function public.get_wiki_preview(p_wiki_id uuid)
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
    w.id, w.name,
    case when private.can_view_wiki(w.id) then w.description end,
    w.cover_url, w.theme_color, w.visibility,
    w.owner_id, p.nickname,
    private.can_view_wiki(w.id),
    (select r.status from public.access_requests r
      where r.wiki_id = w.id and r.requester_id = auth.uid())
  from public.wikis w
  join public.profiles p on p.id = w.owner_id
  where auth.uid() is not null
    and w.id = p_wiki_id
    and (w.visibility in ('approved', 'public') or private.can_view_wiki(w.id));
$$;

-- 탐색: 전체 공개 + 승인제 위키 (내 위키 제외). 승인제는 권한 전까지 소개·캐릭터 수를 숨김.
-- 검색어는 제목에서 찾고, 볼 권한이 있는 위키만 소개에서도 찾음.
create function public.explore_wikis(p_query text default '', p_limit int default 20, p_offset int default 0)
returns table (
  id uuid,
  name text,
  description text,
  cover_url text,
  theme_color text,
  visibility public.visibility_level,
  owner_nickname text,
  character_count int,
  can_view boolean,
  my_request_status public.request_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as text),
  candidates as (
    select w.*, private.can_view_wiki(w.id) as viewable
    from public.wikis w
    where auth.uid() is not null
      and w.visibility in ('public', 'approved')
      and w.owner_id <> auth.uid()
  )
  select
    c.id, c.name,
    case when c.viewable then c.description end,
    c.cover_url, c.theme_color, c.visibility, p.nickname,
    case when c.viewable then
      (select count(*)::int from public.characters ch
        where ch.wiki_id = c.id and private.can_view_character(ch.id))
    end,
    c.viewable,
    (select r.status from public.access_requests r where r.wiki_id = c.id and r.requester_id = auth.uid()),
    c.created_at
  from candidates c
  join public.profiles p on p.id = c.owner_id, q
  where q.text = ''
     or strpos(lower(c.name), q.text) > 0
     or (c.viewable and strpos(lower(c.description), q.text) > 0)
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 공유 토큰 가져오기 (주인만)
create function public.get_share_token(p_wiki_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select w.share_token from public.wikis w
  where w.id = p_wiki_id and w.owner_id = auth.uid();
$$;

-- 공유 링크 열기: 토큰이 맞고 위키가 "링크 공개"면 열람 기록을 남기고 위키 id 를 돌려줌
create function public.redeem_share_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wiki public.wikis%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요.';
  end if;

  select * into v_wiki from public.wikis w where w.share_token = p_token;
  if not found then
    raise exception '링크가 올바르지 않거나 만료되었어요.';
  end if;

  if v_wiki.owner_id = auth.uid() or v_wiki.visibility = 'public' then
    return v_wiki.id;
  end if;
  if v_wiki.visibility <> 'link' then
    raise exception '이 위키는 지금 링크로 볼 수 없어요.';
  end if;

  insert into public.link_grants (wiki_id, user_id, share_token)
  values (v_wiki.id, auth.uid(), v_wiki.share_token)
  on conflict (wiki_id, user_id)
  do update set share_token = excluded.share_token, created_at = now();

  return v_wiki.id;
end;
$$;

-- 내가 보낸 열람 요청 목록 (승인 전에는 위키를 직접 못 읽으므로 함수로 제목·표지만)
create function public.my_access_requests()
returns table (
  id uuid,
  wiki_id uuid,
  wiki_name text,
  cover_url text,
  theme_color text,
  owner_nickname text,
  status public.request_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, w.id, w.name, w.cover_url, w.theme_color, p.nickname, r.status, r.created_at
  from public.access_requests r
  join public.wikis w on w.id = r.wiki_id
  join public.profiles p on p.id = w.owner_id
  where r.requester_id = auth.uid()
  order by r.created_at desc;
$$;

-- regenerate_share_token 은 기존 함수 그대로 (주인만, 토큰 교체 → 링크 열람자 전원 무효)

revoke execute on function public.get_wiki_preview(uuid) from public, anon;
revoke execute on function public.regenerate_share_token(uuid) from public, anon;
revoke execute on function public.explore_wikis(text, int, int) from public, anon;
revoke execute on function public.get_share_token(uuid) from public, anon;
revoke execute on function public.redeem_share_token(text) from public, anon;
revoke execute on function public.my_access_requests() from public, anon;
grant execute on function public.get_wiki_preview(uuid) to authenticated;
grant execute on function public.regenerate_share_token(uuid) to authenticated;
grant execute on function public.explore_wikis(text, int, int) to authenticated;
grant execute on function public.get_share_token(uuid) to authenticated;
grant execute on function public.redeem_share_token(text) to authenticated;
grant execute on function public.my_access_requests() to authenticated;

-- 내부 권한 함수는 앱(API)에서 직접 부를 일이 없음 (private 스키마라 API 에 노출도 안 됨)
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
