-- =====================================================================
-- 1) 테이블 만들기
--    OC 위키의 기본 테이블 8개와 공통 트리거를 만듭니다.
--    권한(RLS)은 다음 파일(20261111000002_rls.sql)에서 설정합니다.
-- =====================================================================

-- 공개 범위: 비공개 / 링크 공개 / 승인한 사람만 / 전체 공개
create type public.visibility_level as enum ('private', 'link', 'approved', 'public');

-- 열람 요청 상태: 대기 / 승인 / 거절(철회 포함)
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------
-- profiles: 사용자 프로필 (auth.users 와 1:1)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 30),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- wikis: 사용자가 만드는 위키
-- ---------------------------------------------------------------------
create table public.wikis (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 50),
  description  text not null default '' check (char_length(description) <= 2000),
  cover_url    text,
  theme_color  text not null default '#6366f1' check (theme_color ~ '^#[0-9a-fA-F]{6}$'),
  visibility   public.visibility_level not null default 'private',
  -- "링크 공개"용 비밀 토큰 (추측할 수 없는 32자리)
  share_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at   timestamptz not null default now()
);
create index wikis_owner_id_idx on public.wikis (owner_id);
create index wikis_public_idx on public.wikis (created_at desc) where visibility = 'public';

-- ---------------------------------------------------------------------
-- rooms: 위키 안에서 캐릭터를 묶는 방(그룹)
-- ---------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  wiki_id     uuid not null references public.wikis (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  -- characters 가 "같은 위키의 방"만 고를 수 있게 하기 위한 키
  unique (id, wiki_id)
);
create index rooms_wiki_id_idx on public.rooms (wiki_id, sort_order);

-- ---------------------------------------------------------------------
-- characters: 캐릭터
-- ---------------------------------------------------------------------
create table public.characters (
  id              uuid primary key default gen_random_uuid(),
  wiki_id         uuid not null references public.wikis (id) on delete cascade,
  room_id         uuid,            -- 비어 있으면 "방 없음"
  name            text not null check (char_length(name) between 1 and 50),
  tagline         text not null default '' check (char_length(tagline) <= 200),
  cover_image_id  uuid,            -- 대표 이미지 (아래에서 FK 연결)
  visibility      public.visibility_level not null default 'private',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  -- 방은 반드시 같은 위키의 방이어야 함. 방이 지워지면 room_id 만 비움.
  foreign key (room_id, wiki_id) references public.rooms (id, wiki_id)
    on update cascade on delete set null (room_id)
);
create index characters_wiki_id_idx on public.characters (wiki_id, sort_order);
create index characters_room_id_idx on public.characters (room_id);

-- ---------------------------------------------------------------------
-- character_fields: 사용자가 자유롭게 추가하는 항목 (예: 외모, 성격)
-- ---------------------------------------------------------------------
create table public.character_fields (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters (id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 50),
  content       text not null default '' check (char_length(content) <= 20000),
  sort_order    integer not null default 0
);
create index character_fields_character_id_idx on public.character_fields (character_id, sort_order);

-- ---------------------------------------------------------------------
-- character_images: 캐릭터 이미지 (원본 + 썸네일)
--   image_url / thumb_url 에는 Storage 의 공개 URL 을 저장합니다.
-- ---------------------------------------------------------------------
create table public.character_images (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters (id) on delete cascade,
  image_url     text not null,
  thumb_url     text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (id, character_id)
);
create index character_images_character_id_idx on public.character_images (character_id, sort_order);

-- 대표 이미지는 "그 캐릭터의 이미지"만 지정 가능. 이미지가 지워지면 대표 이미지만 비움.
alter table public.characters
  add constraint characters_cover_image_fk
  foreign key (cover_image_id, id) references public.character_images (id, character_id)
  on delete set null (cover_image_id);

-- ---------------------------------------------------------------------
-- character_logs: 캐릭터 로그 (제목 + 본문 게시글)
-- ---------------------------------------------------------------------
create table public.character_logs (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 100),
  body          text not null default '' check (char_length(body) <= 50000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index character_logs_character_id_idx on public.character_logs (character_id, created_at desc);

-- ---------------------------------------------------------------------
-- access_requests: 남의 위키 열람 요청
-- ---------------------------------------------------------------------
create table public.access_requests (
  id            uuid primary key default gen_random_uuid(),
  wiki_id       uuid not null references public.wikis (id) on delete cascade,
  requester_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status        public.request_status not null default 'pending',
  created_at    timestamptz not null default now(),
  unique (wiki_id, requester_id)   -- 한 위키에 한 사람당 요청 1개
);
create index access_requests_requester_idx on public.access_requests (requester_id);
create index access_requests_wiki_status_idx on public.access_requests (wiki_id, status);

-- =====================================================================
-- 트리거
-- =====================================================================

-- 로그 수정 시 updated_at 자동 갱신
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger character_logs_set_updated_at
  before update on public.character_logs
  for each row execute function public.set_updated_at();

-- 회원가입하면 profiles 행을 자동으로 만듦
-- 닉네임: 가입 시 넘긴 nickname → 없으면 이메일 앞부분 → 없으면 '새 사용자'
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '새 사용자'
    ), 30)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 열람 요청의 "누가 / 어느 위키" 는 바꿀 수 없게 고정 (상태만 바꿀 수 있음)
create function public.lock_access_request_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.wiki_id <> old.wiki_id or new.requester_id <> old.requester_id then
    raise exception '열람 요청의 위키나 요청자는 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger access_requests_lock_keys
  before update on public.access_requests
  for each row execute function public.lock_access_request_keys();

-- 공유 토큰 보호:
-- 전체 공개 / 승인제 상태에서는 열람자도 share_token 을 볼 수 있으므로,
-- 그 상태에서 "링크 공개"로 바꾸면 토큰을 새로 만들어 예전 열람자가 링크로 들어오지 못하게 함.
-- (비공개 → 링크 공개는 주인만 토큰을 봤으므로 그대로 둠)
create function public.rotate_share_token_on_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'link'
     and old.visibility in ('public', 'approved')
     and new.share_token = old.share_token then
    new.share_token := replace(gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

create trigger wikis_rotate_share_token
  before update of visibility on public.wikis
  for each row execute function public.rotate_share_token_on_visibility();
