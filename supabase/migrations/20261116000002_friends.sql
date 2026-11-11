-- =====================================================================
-- 친구 기능 (2/2)  ※ 20261116000001_friends_enum.sql 을 먼저 실행
--
--  1) 고유코드: profiles.friend_code (8자리, 각자 하나, 바꿀 수 없음, 헷갈리는 0/O/1/I 제외)
--  2) 친구 관계: friendships (신청 pending → 상대가 수락 accepted). 신청은 send_friend_request() 로만.
--     수락은 받은 사람만, 삭제(거절·신청 취소·친구 끊기)는 둘 중 누구나.
--  3) 공개 범위 "friends": 위키 주인과 친구(accepted)인 로그인 사용자만 볼 수 있음
--  4) RPC: explore_wikis(캐릭터 이름 검색·친구 공개 위키·특정 사용자 위키), search_profiles(닉네임·고유코드),
--          send_friend_request, home_feed(나 + 친구의 최근 로그)
-- 여러 번 실행해도 안전하도록 작성.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 고유코드
-- ---------------------------------------------------------------------
create or replace function private.new_friend_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = code);
  end loop;
  return code;
end;
$$;

alter table public.profiles add column if not exists friend_code text;
update public.profiles set friend_code = private.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_friend_code_key') then
    alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_friend_code_format') then
    alter table public.profiles add constraint profiles_friend_code_format check (friend_code ~ '^[A-Z0-9]{8}$');
  end if;
end $$;

-- 새 계정은 자동으로 코드가 생기고, 수정으로는 바꿀 수 없음
create or replace function public.keep_friend_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.friend_code := private.new_friend_code();
  else
    new.friend_code := old.friend_code;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_keep_friend_code on public.profiles;
create trigger profiles_keep_friend_code
  before insert or update on public.profiles
  for each row execute function public.keep_friend_code();

-- ---------------------------------------------------------------------
-- 2) 친구 관계
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  check (requester_id <> addressee_id)
);

-- 두 사람 사이에는 한 줄만 (A→B 와 B→A 를 같은 것으로 봄)
create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_requester_idx on public.friendships (requester_id);

alter table public.friendships enable row level security;
revoke all on public.friendships from public, anon, authenticated;
grant select, delete on public.friendships to authenticated;  -- 추가는 send_friend_request() 로만
grant update (status) on public.friendships to authenticated; -- 상태만 바꿀 수 있음

drop policy if exists "내 친구 관계만 조회" on public.friendships;
create policy "내 친구 관계만 조회" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

drop policy if exists "받은 신청만 수락" on public.friendships;
create policy "받은 신청만 수락" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status = 'accepted');

drop policy if exists "둘 중 누구나 삭제" on public.friendships;
create policy "둘 중 누구나 삭제" on public.friendships
  for delete to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- 수락 시각 자동 기록
create or replace function public.friendship_set_accepted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_accepted_at on public.friendships;
create trigger friendships_accepted_at
  before update on public.friendships
  for each row execute function public.friendship_set_accepted_at();

-- 두 사람이 친구인가?
create or replace function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(p_a, p_b)
      and greatest(f.requester_id, f.addressee_id) = greatest(p_a, p_b)
  );
$$;

-- 나와 이 사람의 관계: me / friends / sent(내가 신청) / received(받은 신청) / none
create or replace function private.friend_status(p_other uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_other = auth.uid() then 'me'
    else coalesce((
      select case
        when f.status = 'accepted' then 'friends'
        when f.requester_id = auth.uid() then 'sent'
        else 'received'
      end
      from public.friendships f
      where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_other)
        and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_other)
    ), 'none')
  end;
$$;

-- ---------------------------------------------------------------------
-- 3) 공개 범위 판단에 "friends" 추가 (나머지는 4단계와 같음)
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
    when 'friends' then exists (
      select 1 from public.wikis w
      where w.id = p_wiki_id and private.are_friends(auth.uid(), w.owner_id)
    )
    else false
  end;
$$;

-- ---------------------------------------------------------------------
-- 4) RPC
-- ---------------------------------------------------------------------

-- 친구 신청: 상대가 이미 나에게 신청했으면 바로 친구가 됨. 돌려주는 값: 'sent' | 'friends'
create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  f public.friendships%rowtype;
begin
  if v_me is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_user_id is null or p_user_id = v_me then
    raise exception '나 자신에게는 친구 신청을 할 수 없어요.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception '사용자를 찾을 수 없어요.';
  end if;

  select * into f from public.friendships x
  where least(x.requester_id, x.addressee_id) = least(v_me, p_user_id)
    and greatest(x.requester_id, x.addressee_id) = greatest(v_me, p_user_id)
  for update;

  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.requester_id = v_me then return 'sent'; end if;
    update public.friendships set status = 'accepted' where id = f.id;
    return 'friends';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_me, p_user_id);
  return 'sent';
end;
$$;

-- 계정 검색: 고유코드(정확히 일치, 앞의 # 무시) 또는 닉네임(일부 일치). 나는 제외.
create or replace function public.search_profiles(p_query text, p_limit int default 20)
returns table (id uuid, nickname text, avatar_url text, friend_code text, friend_status text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select trim(coalesce(p_query, '')) as raw)
  select p.id, p.nickname, p.avatar_url, p.friend_code, private.friend_status(p.id)
  from public.profiles p, q
  where auth.uid() is not null
    and q.raw <> ''
    and p.id <> auth.uid()
    and (p.friend_code = upper(ltrim(q.raw, '#')) or strpos(lower(p.nickname), lower(q.raw)) > 0)
  order by (p.friend_code = upper(ltrim(q.raw, '#'))) desc, p.nickname
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- 탐색(위키): 전체 공개 + 승인제 + (볼 수 있는) 친구 공개 위키.
--  검색어는 위키 제목 / 캐릭터 이름(볼 수 있는 캐릭터만) / 소개(볼 수 있는 위키만) 에서 찾음.
--  p_owner 를 주면 그 사람의 위키만 (프로필 화면용). 없으면 내 위키는 제외.
drop function if exists public.explore_wikis(text, int, int);
drop function if exists public.explore_wikis(text, int, int, uuid);
create function public.explore_wikis(
  p_query text default '',
  p_limit int default 20,
  p_offset int default 0,
  p_owner uuid default null
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  cover_url text,
  theme_color text,
  visibility public.visibility_level,
  owner_nickname text,
  character_count int,
  can_view boolean,
  my_request_status public.request_status,
  matched_characters text[],
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
      and (case when p_owner is null then w.owner_id <> auth.uid() else w.owner_id = p_owner end)
      and (w.visibility in ('public', 'approved') or (w.visibility = 'friends' and private.can_view_wiki(w.id)))
  ),
  hits as (
    select c.*,
      case when q.text = '' or not c.viewable then array[]::text[] else array(
        select ch.name from public.characters ch
        where ch.wiki_id = c.id
          and strpos(lower(ch.name), q.text) > 0
          and private.can_view_character(ch.id)
        order by ch.sort_order, ch.created_at
        limit 5
      ) end as matched
    from candidates c, q
  )
  select
    h.id, h.owner_id, h.name,
    case when h.viewable then h.description end,
    h.cover_url, h.theme_color, h.visibility, p.nickname,
    case when h.viewable then
      (select count(*)::int from public.characters ch
        where ch.wiki_id = h.id and private.can_view_character(ch.id))
    end,
    h.viewable,
    (select r.status from public.access_requests r where r.wiki_id = h.id and r.requester_id = auth.uid()),
    h.matched,
    h.created_at
  from hits h
  join public.profiles p on p.id = h.owner_id, q
  where q.text = ''
     or strpos(lower(h.name), q.text) > 0
     or (h.viewable and strpos(lower(h.description), q.text) > 0)
     or cardinality(h.matched) > 0
  order by h.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 홈: 나와 친구의 위키에 올라온 최근 로그 (내가 볼 수 있는 캐릭터의 로그만). 최신순.
create or replace function public.home_feed(p_limit int default 20, p_before timestamptz default null)
returns table (
  log_id uuid,
  title text,
  created_at timestamptz,
  character_id uuid,
  character_name text,
  thumb_url text,
  wiki_id uuid,
  wiki_name text,
  theme_color text,
  owner_id uuid,
  owner_nickname text,
  owner_avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id, l.title, l.created_at,
    c.id, c.name,
    (select i.thumb_url from public.character_images i
      where i.character_id = c.id
      order by (i.id = c.cover_image_id) desc, i.sort_order
      limit 1),
    w.id, w.name, w.theme_color,
    w.owner_id, p.nickname, p.avatar_url
  from public.character_logs l
  join public.characters c on c.id = l.character_id
  join public.wikis w on w.id = c.wiki_id
  join public.profiles p on p.id = w.owner_id
  where auth.uid() is not null
    and (w.owner_id = auth.uid() or private.are_friends(auth.uid(), w.owner_id))
    and private.can_view_character(c.id)
    and (p_before is null or l.created_at < p_before)
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.search_profiles(text, int) from public, anon;
revoke execute on function public.explore_wikis(text, int, int, uuid) from public, anon;
revoke execute on function public.home_feed(int, timestamptz) from public, anon;
revoke execute on function public.keep_friend_code() from public, anon, authenticated;
revoke execute on function public.friendship_set_accepted_at() from public, anon, authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.search_profiles(text, int) to authenticated;
grant execute on function public.explore_wikis(text, int, int, uuid) to authenticated;
grant execute on function public.home_feed(int, timestamptz) to authenticated;

revoke execute on function private.new_friend_code() from public, anon, authenticated;
revoke execute on function private.are_friends(uuid, uuid) from public, anon;
revoke execute on function private.friend_status(uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.friend_status(uuid) to authenticated;

notify pgrst, 'reload schema';
