# CLAUDE.md — 자작 캐릭터 위키 앱 (OC 위키)

이 파일은 이 프로젝트에서 작업하는 개발자(사람·AI)가 가장 먼저 읽는 안내서입니다.
**단계가 끝날 때마다 "현재 단계"와 "결정 사항"을 갱신하세요.**

## 사용자 / 작업 방식
- 프로젝트 주인은 개발 초보자. 설명은 쉽게.
- 질문은 꼭 필요할 때만 하고, 나머지는 합리적으로 정해서 진행한 뒤 마지막에 정한 것을 요약.

## 서비스 설명
- 사용자가 각자 계정을 만들고, 자기 자작 캐릭터(OC)를 "위키" 형태로 정리한다.
- 위키 안에서 캐릭터를 "방(그룹)" 단위로 묶는다.
- 위키마다 공개 범위: 비공개(private) / 링크 공개(link) / 승인한 사람만(approved) / 전체 공개(public). 기본값은 비공개.
- 남의 위키는 "열람 요청" → 주인 승인 → 열람. 주인은 언제든 철회할 수 있다.
- 캐릭터 세부 항목(외모, 성격 등)은 사용자가 항목 이름과 내용을 자유롭게 추가한다.
- 캐릭터마다 로그(제목·본문 게시글)를 올릴 수 있다.
- 캐릭터마다 이미지 여러 장. 썸네일 + 지연 로딩으로 빠르게.
- 웹 + Capacitor 안드로이드 APK. UI는 폰 우선(mobile first).

## 기술 스택 (바꾸지 말 것)
React + Vite + TypeScript, Tailwind CSS(v4, `@tailwindcss/vite`), React Router, Supabase(Auth / Postgres / Storage), Capacitor(Android).

## 규칙
- 권한은 프론트에서 버튼 숨기기로 끝내지 말고 **Supabase RLS 정책으로 서버에서 반드시 막는다.**
- 비밀값은 `.env`에만. `.env`는 `.gitignore`에 포함. `.env.example` 유지.
  - 앱에는 anon(publishable) 키만 넣는다. service_role / secret 키는 절대 앱 코드나 `.env`에 넣지 않는다.
- 모든 화면 문구는 한국어.
- 이 CLAUDE.md를 단계마다 갱신.

## 폴더 구조
```
src/
  lib/supabase.ts      Supabase 클라이언트 (기본 + 링크 공개용 createShareClient)
  App.tsx              (1단계) 연결 확인용 임시 화면
supabase/migrations/   DB SQL (파일명 순서대로 적용)
  20261111000001_tables.sql   테이블, 타입, 트리거
  20261111000002_rls.sql      RLS 정책, 권한 함수, RPC
  20261111000003_storage.sql  이미지 버킷과 정책
```

## DB 설계 요약
- 테이블: profiles, wikis, rooms, characters, character_fields, character_images, character_logs, access_requests
- enum: `visibility_level`(private/link/approved/public), `request_status`(pending/approved/rejected)
- 회원가입 시 트리거가 profiles 행 자동 생성 (닉네임: 가입 시 metadata.nickname → 이메일 앞부분 → '새 사용자')
- 권한 함수는 API에 노출되지 않는 `private` 스키마에 있음 (`can_view_wiki`, `can_view_character`, `is_wiki_owner` 등)
- RPC: `get_wiki_preview(p_wiki_id)` 승인제 위키 미리보기 + 내 요청 상태, `regenerate_share_token(p_wiki_id)` 공유 링크 재발급

### 권한 규칙
| 공개 범위 | 볼 수 있는 사람 |
|---|---|
| private | 주인만 |
| link | 주인 + 공유 토큰을 `x-share-token` 헤더로 보낸 사람 (로그인 불필요) |
| approved | 주인 + 열람 요청이 approved 인 사람 |
| public | 누구나 (비로그인 포함) |

- 캐릭터는 **위키 공개 범위와 캐릭터 공개 범위를 둘 다 통과**해야 보임. 항목/이미지/로그는 캐릭터를 볼 수 있으면 보임.
- 쓰기(생성·수정·삭제)는 모두 위키 주인만.
- 열람 요청: 공개 범위가 approved 인 남의 위키에만, pending 상태로만 생성 가능. 상태 변경(승인/거절/철회)은 주인만. 철회 = status를 rejected로 바꾸거나 행 삭제. 요청자는 자기 요청 삭제(취소) 가능 → 다시 요청 가능.
- 공개/승인제 → 링크 공개로 바꾸면 share_token 자동 교체 (예전 열람자가 토큰을 봤을 수 있으므로).
- 방은 같은 위키의 방만 지정 가능, 방 삭제 시 캐릭터의 room_id만 비움. 대표 이미지는 그 캐릭터의 이미지만 가능, 이미지 삭제 시 비움.

### 이미지 저장 방식
- Storage 버킷 `media` (공개 버킷, 10MB, jpeg/png/webp/gif).
- 경로: `{user_id}/...` — 업로드/수정/삭제는 첫 폴더가 본인 id일 때만 (RLS).
- 파일명은 무작위(UUID). 보기는 공개 URL (캐시·속도 목적). 주소는 RLS로 보호되는 테이블에만 저장됨.
- 썸네일은 업로드 시 브라우저에서 리사이즈(webp)해서 함께 올림 → `thumb_url`. 목록에서는 썸네일 + `loading="lazy"`. (구현 예정)

## 개발 명령
- `npm install` 패키지 설치
- `npm run dev` 개발 서버 (http://localhost:5173)
- `npm run build` 배포용 빌드 / `npm run lint` 코드 검사

## 현재 단계
- [x] **1단계 준비**: Vite+React+TS+Tailwind 프로젝트, Supabase 연결 모듈, DB 마이그레이션(테이블·RLS·Storage), .env.example. 로컬 Postgres에서 RLS 동작 테스트 40개 통과.
- [ ] 2단계 (예정): 라우팅 + 회원가입/로그인 + 내 위키 목록/생성
- [ ] 이후: 방/캐릭터 CRUD, 자유 항목, 이미지 업로드(썸네일·지연 로딩), 로그, 공개 범위·공유 링크·열람 요청 UI, Capacitor 안드로이드

## 결정 사항 메모
- 캐릭터 visibility 기본값은 DB상 private(명세대로). 앱에서 캐릭터를 새로 만들 때는 위키의 공개 범위를 기본으로 넣어 줄 예정.
- 명세 외로 추가한 컬럼: wikis/rooms/characters/character_images/profiles 의 `created_at`.
- Capacitor는 화면이 생긴 뒤 단계에서 설치.
