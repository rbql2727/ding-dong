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
- 보조 라이브러리: TipTap v3(로그 편집기), 글꼴(갈무리 — `src/assets/fonts`, 프리텐다드 `pretendard`, 노토산스 `@fontsource/noto-sans-kr`). 모두 앱에 포함(오프라인 APK에서도 작동).

## 규칙
- 권한은 프론트에서 버튼 숨기기로 끝내지 말고 **Supabase RLS 정책으로 서버에서 반드시 막는다.**
- 비밀값은 `.env`에만. `.env`는 `.gitignore`에 포함. `.env.example` 유지.
  - 앱에는 anon(publishable) 키만 넣는다. service_role / secret 키는 절대 앱 코드나 `.env`에 넣지 않는다.
- 모든 화면 문구는 한국어.
- 이 CLAUDE.md를 단계마다 갱신.

## 폴더 구조
```
src/
  main.tsx               BrowserRouter + AuthProvider 로 앱 감싸기
  App.tsx                라우트 목록 (공개 전용 / 탭 화면(AppLayout) / 하위 화면(SubLayout))
  auth/                  authApi(가입·로그인·소셜 설정), AuthContext(useAuth), AuthProvider, routes(보호 라우트), SocialLoginButtons
  data/                  ★ Supabase 쿼리는 전부 여기 (화면 코드에서 supabase 직접 호출 X)
    db.ts                check() 응답 확인 + 한국어 오류, NotFoundError
    wikis.ts             목록(+캐릭터 수), 조회, 생성(표지 업로드), 수정, 삭제(파일 정리 포함)
    rooms.ts             목록, 생성, 이름 변경, 삭제, 순서 저장
    characters.ts        카드 목록(썸네일만), 전체 조회, saveCharacter(항목·이미지·대표 이미지 한 번에), 삭제
    logs.ts              목록(최신순), 조회, 생성, 수정, 삭제, 본문 이미지 업로드
    sharing.ts           위키 미리보기, 탐색, 공유 링크(토큰 조회·재발급·열기), 열람 요청(보내기·취소·승인·거절·철회)
  components/
    AppLayout.tsx        하단 탭 5개(홈/탐색/내 위키/알림/프로필)
    SubLayout.tsx        하위 화면용 (탭 없음)
    ui.tsx               Button(primary/secondary/danger/dangerSolid/theme), TextField, TextArea, BackHeader, IconButton, EmptyState, Avatar 등
    Modal.tsx            Modal, PromptModal, ConfirmModal, ActionSheet (아래에서 올라오는 창)
    ImageViewer.tsx      이미지 크게 보기 (원본)
    log/                 ★ 로그 편집기 (TipTap)
      extensions.ts      편집기·보기 공통 기능 목록 (logDocCore 허용 목록과 맞출 것)
      LogEditor.tsx      툴바 + 편집 영역, getBody() 로 정리된 JSON 반환, 사진 붙여넣기·끌어놓기 업로드
      LogToolbar.tsx     글꼴·굵게·기울임·밑줄·취소선·형광펜·글자색·링크·이미지·정렬·표·인용·구분선·목록·들여쓰기
      LogViewer.tsx      읽기 전용 보기 (정리된 문서만)
      LogImageView.tsx   본문 이미지 (서명 주소, 외부 이미지는 안내만)
    MediaImg.tsx         ★ 업로드한 이미지는 반드시 이걸로 표시 (서명 주소로 바꿔 줌)
    VisibilityPicker.tsx 공개 범위 고르기
    icons.tsx            SVG 아이콘
  lib/
    supabase.ts          클라이언트 (기본 + 링크 공개용 createShareClient), SUPABASE_URL
    storage.ts           ★ 파일 경로 규칙(mediaPaths), 크기 기준(IMAGE_SIZE), 업로드/원본+썸네일 업로드/삭제
    signedUrl.ts         서명 주소 일괄 요청 + 메모리 캐시(30분), 로그아웃 시 비움
    useMediaUrl.ts       저장된 주소 → 화면용 주소 훅
    visibility.ts        공개 범위 문구
    image.ts             브라우저에서 이미지 줄이기(webp, 실패 시 jpg), checkImageFile
    logDocCore.ts        ★ 로그 문서 규칙: 허용 목록 정리(sanitizeDoc), 예전 형식 변환, 미리보기, 이미지 추출, 글꼴·색 목록
    richText.ts          logDocCore 에 "우리 Storage 이미지만" 규칙을 연결 (safeDocFromBody, extractImageUrls, toPreview)
    useLoad.ts           데이터 불러오기 훅 (data/loading/error/reload/setData)
    theme.ts             위키 테마 색 목록, themeStyle() → CSS 변수 --wiki
    format.ts            날짜 표시 (한국어)
    types.ts             DB 타입
  pages/
    auth/                LoginPage, SignupPage
    tabs/                HomePage(TabPages.tsx), ExplorePage(탐색·검색), NotificationsPage(받은/보낸 요청), ProfilePage
    wiki/                MyWikisPage, WikiFormPage(만들기·설정·공개 범위·공유 링크), WikiHomePage(미리보기→내용 또는 잠금),
                         LockedWikiView(열람 요청), AccessManagePage(승인 관리), ShareLinkPage(/s/:token)
    character/           CharacterFormPage(새로·편집), CharacterDetailPage(프로필/로그 탭)
    log/                 LogPages.tsx (LogDetailPage, LogEditorPage)
supabase/
  migrations/            DB SQL (파일명 순서대로 적용)
    20261111000001_tables.sql            테이블, 타입, 트리거(가입 시 프로필 자동 생성 포함)
    20261111000002_rls.sql               RLS 정책, 권한 함수, RPC
    20261111000003_storage.sql           이미지 버킷과 정책
    20261112000001_profiles_backfill.sql 프로필 없는 기존 계정 보충 (여러 번 실행해도 안전)
    20261113000001_sharing_security.sql  4단계: 로그인 필수, 링크 열람 기록, 토큰 숨김, 탐색·미리보기 RPC, Storage 비공개+파일별 권한
    20261114000001_log_body_limit.sql    로그 본문 길이 제한 5만 → 30만 자 (편집기 문서 JSON 용)
  tests/
    two_accounts_check.sql      계정 2개 권한 테스트 (2단계)
    stage4_security_check.sql   ★ 4단계 보안 테스트 53개 (a 비공개 / b 승인 전 / c 승인 후 / d 철회 + 링크·전체 공개·이미지·비로그인)
tests/
  logDocCore.test.mts    로그 문서 정리(보안) 테스트 21개 — `npm test`
src/assets/fonts/        갈무리 글꼴 + 라이선스(SIL OFL)
```

## DB 설계 요약
- 테이블: profiles, wikis, rooms, characters, character_fields, character_images, character_logs, access_requests
- enum: `visibility_level`(private/link/approved/public), `request_status`(pending/approved/rejected)
- 회원가입 시 트리거가 profiles 행 자동 생성 (닉네임: 가입 시 metadata.nickname → 이메일 앞부분 → '새 사용자')
- 권한 함수는 API에 노출되지 않는 `private` 스키마에 있음 (`can_view_wiki`, `can_view_character`, `is_wiki_owner` 등)
- RPC: `get_wiki_preview(p_wiki_id)` 승인제 위키 미리보기 + 내 요청 상태, `regenerate_share_token(p_wiki_id)` 공유 링크 재발급

### 권한 규칙 (4단계부터)
| 공개 범위 | 볼 수 있는 사람 |
|---|---|
| private | 주인만 |
| link | 주인 + 공유 링크(`/s/:token`)를 열어 `link_grants` 에 기록된 **로그인 사용자**. 링크 재발급(토큰 교체) 시 기록 전부 무효 |
| approved | 주인 + 열람 요청이 approved 인 사용자. 그 외 로그인 사용자는 **제목·표지·주인 닉네임만** (get_wiki_preview / explore_wikis) |
| public | 로그인한 모든 사용자 |

- **로그인 안 한 사용자(anon)는 아무 테이블·RPC도 못 씀** (권한 자체를 회수).
- 캐릭터는 **위키 공개 범위와 캐릭터 공개 범위를 둘 다 통과**해야 보임. 항목/이미지/로그는 소속 캐릭터를 볼 수 있으면 보임.
- 쓰기(생성·수정·삭제)는 모두 위키 주인만.
- `wikis.share_token` 열은 열 단위 권한으로 **주인 외 읽기 불가** → 주인은 `get_share_token()` RPC로.
- 열람 요청: approved 위키에만, pending 상태로만 생성. unique(wiki_id, requester_id)로 중복 방지. 승인/거절/철회(=rejected)는 주인만. 요청자는 자기 요청 삭제(취소) 후 다시 요청 가능.
- 공개/승인제 → 링크 공개로 바꾸면 share_token 자동 교체.
- 방은 같은 위키의 방만 지정 가능, 방 삭제 시 캐릭터의 room_id만 비움. 대표 이미지는 그 캐릭터의 이미지만 가능, 이미지 삭제 시 비움.
- RPC 목록: `get_wiki_preview`, `explore_wikis(query, limit, offset)`, `get_share_token`, `regenerate_share_token`, `redeem_share_token(token)`, `my_access_requests`.

### 화면 주소
| 주소 | 화면 |
|---|---|
| `/wikis` | 내 위키 목록 (탭) |
| `/wikis/new` | 위키 만들기 |
| `/w/:wikiId` | 위키 홈 (방별 캐릭터 카드, 방 추가·이름·순서·삭제) |
| `/w/:wikiId/settings` | 위키 설정·공개 범위·공유 링크·삭제 |
| `/w/:wikiId/access` | 열람 승인 관리 (받은 요청 승인·거절, 승인한 사람 철회) |
| `/s/:token` | 공유 링크로 들어오기 (로그인 필요) |
| `/explore` | 탐색 (전체 공개 + 승인제 위키, 검색) |
| `/notifications` | 알림 (받은 열람 요청, 보낸 요청 상태) |
| `/w/:wikiId/c/new?room=` | 캐릭터 만들기 |
| `/w/:wikiId/c/:charId` (`?tab=logs`) | 캐릭터 상세 (프로필 / 로그 탭) |
| `/w/:wikiId/c/:charId/edit` | 캐릭터 편집·삭제 |
| `/w/:wikiId/c/:charId/logs/new`, `/logs/:logId`, `/logs/:logId/edit` | 로그 쓰기 / 보기 / 수정 |

### 이미지 저장 방식
- Storage 버킷 `media` — **4단계부터 비공개 버킷**. 파일마다 `private.can_view_media(경로)` 정책이 볼 권한을 판단:
  - `{uid}/avatar/*` 로그인 사용자 누구나 / `{uid}/wikis/{wikiId}/cover-*` 위키를 볼 수 있거나 승인제·전체 공개면 로그인 사용자 누구나 (탐색 표지)
  - `{uid}/wikis/{wikiId}/characters/{charId}/...` 그 캐릭터를 볼 수 있는 사람만 (로그 이미지 포함)
  - 폴더 주인≠위키 주인, 캐릭터≠그 위키 소속, 그 밖의 경로 → 파일 주인만
- 업로드/수정/삭제는 첫 폴더가 본인 id일 때만.
- DB 에는 공개 URL 형식 주소를 "파일 이름표"로 저장 (예전 데이터와 호환). **직접 열리지 않음** → 화면은 `MediaImg` 가 `createSignedUrls` 로 받은 30분짜리 서명 주소로 표시. 권한이 철회돼도 이미 받은 서명 주소는 최대 30분까지 유효.
- 크기 기준(`lib/storage.ts` IMAGE_SIZE): 캐릭터 원본 긴 변 1600px / 썸네일 400px, 위키 표지 1200px, 프로필 256px 정사각형, 로그 본문 1600px. 모두 브라우저에서 webp로 줄여서 올림 (GIF 움직임은 사라짐).
- 경로: `{uid}/wikis/{wikiId}/cover-*`, `{uid}/wikis/{wikiId}/characters/{charId}/{uuid}.webp` + `{uuid}_thumb.webp`, 로그는 `.../{charId}/logs/{uuid}.webp`, 프로필 `{uid}/avatar/*`.
- **목록(위키 홈 카드, 편집 화면 그리드, 상세 하단 줄)은 thumb_url만**, 원본(image_url)은 캐릭터 상세의 큰 이미지·크게 보기에서만. 모든 목록 이미지는 `loading="lazy"` + `decoding="async"`.
- 삭제 시 파일도 정리: 이미지 빼기, 캐릭터·위키 삭제, 로그 삭제, 로그 수정에서 본문에서 뺀 이미지, 로그 편집 취소 시 이번에 올린 이미지.

### 로그 본문 형식 (5단계부터)
- 툴바 편집기(TipTap) 문서를 **JSON 문자열**로 `character_logs.body` 에 저장: `{"type":"doc","content":[...]}`
- 예전 형식(일반 글 + `**굵게**` + 한 줄 `![설명](주소)` 이미지)은 불러올 때 자동으로 문서로 변환 → 저장하면 새 형식.
- **보안: 보여 주기 전·저장하기 전에 항상 `sanitizeDoc` (허용 목록)**
  - 요소: 문단·줄바꿈·글머리/번호 목록·인용·구분선·표·이미지 / 꾸밈: 굵게·기울임·밑줄·취소선·형광펜·링크·글자색·글꼴
  - 링크는 http(s)/mailto 만 (새 창, noopener). 글자색은 #hex/rgb() 만. 글꼴은 목록 5개 값만. 정렬은 left/center/right/justify 만.
  - 이미지는 우리 Storage(media) 주소만 → 화면에서는 서명 주소로. 다른 사이트 이미지는 저장 시 빠짐.
  - 모르는 요소·속성은 버림, 깊이 30·노드 2만 개 제한.
- 글꼴: 프리텐다드(기본)·노토산스·갈무리는 앱에 포함. **굴림·바탕은 Windows 글꼴이라 앱에 넣을 수 없음** → 그 글꼴이 깔린 기기에서만 그 모양, 아니면 비슷한 글꼴(노토산스 / 명조 계열)로 보임.

### 디자인 (5단계부터: 레트로 픽셀)
- `src/index.css` 의 `@theme` 에서 색 이름을 바꿔 전체 적용: gray → 크림/남색 계열, indigo → 주황, white → 크림(paper). 둥근 모서리 0, 그림자 = 픽셀 단색 그림자.
- 새 색 이름: `ink`(남색), `night`(배경), `paper`(크림), `accent`(주황), `dim`(흐린 글자). 글꼴: `font-title`(갈무리14), 기본 갈무리11.
- 재사용 클래스: `px-window`(창), `px-titlebar`(남색 제목 줄 + 주황 디더), `px-winbtn`(창 버튼), `px-btn`(눌리는 버튼), `px-input`(입력칸), `px-label`(이름표), `px-dashed`, `app-frame`.
- 로그 본문 스타일은 `.log-content` (읽기 편하게 프리텐다드 기본).

## 개발 명령
- `npm install` 패키지 설치
- `npm run dev` 개발 서버 (http://localhost:5173)
- `npm run build` 배포용 빌드 / `npm run lint` 코드 검사 / `npm test` 로그 문서 보안 테스트

## 현재 단계
- [x] **1단계 준비**: Vite+React+TS+Tailwind 프로젝트, Supabase 연결 모듈, DB 마이그레이션(테이블·RLS·Storage), .env.example. 로컬 Postgres에서 RLS 동작 테스트 40개 통과. 실제 Supabase 프로젝트에 SQL 적용 완료(사용자가 SQL Editor로 실행). GitHub `rbql2727/ding-dong` main 브랜치에 업로드.
  - 참고: Claude 클라우드 세션에서는 네트워크 정책상 supabase.co 접속이 막혀 있음 → DB 확인은 사용자 PC에서.
- [x] **2단계 계정**: 이메일 가입·로그인·로그아웃, 보호 라우트, 하단 탭 5개 뼈대, 프로필(닉네임·사진 변경). 소셜 로그인은 구조만(authApi.ts SOCIAL_PROVIDERS). 빌드·lint 통과, 폰 크기 화면 확인. 계정 2개 권한 테스트 SQL 추가(로컬 7개 통과).
  - 사용자 할 일: `20261112000001_profiles_backfill.sql` 실행, 계정 2개로 확인.
- [x] **3단계 위키·캐릭터**: 내 위키 목록/만들기/설정/삭제(이름·소개·표지·테마 색), 위키 홈(방별 캐릭터 카드, 방 추가·이름 변경·순서 변경·삭제), 캐릭터 만들기/편집/삭제(이름·한줄소개·방·자유 항목 추가/삭제/순서·이미지 여러 장·대표 이미지·순서), 캐릭터 상세(프로필/로그 탭, 원본은 상세에서만), 로그 목록(최신순)/상세/쓰기/수정/삭제, 본문 편집기(굵게·이미지·미리보기). 공개 범위 UI는 없음 → 모두 기본값 private(주인만).
  - 검증: 빌드·lint 통과, 가짜 데이터로 폰 화면 확인, 로컬 Postgres에서 앱의 DB 흐름을 RLS 아래 재현(주인 전부 가능 / 다른 계정 0행·쓰기 차단 / 위키 삭제 시 남는 행 0). 실제 Supabase(PostgREST·Storage)로는 사용자 PC에서 확인 필요.
- [x] **4단계 공개·승인**: 마이그레이션 `20261113000001_sharing_security.sql`(로그인 필수, 링크 열람 기록, 토큰 숨김, Storage 비공개+파일별 권한, 탐색·미리보기·링크 RPC). 위키·캐릭터 공개 범위 선택, 공유 링크(복사·재발급), 잠긴 위키 화면+열람 요청(중복 방지), 승인 관리(승인·거절·철회·재승인), 탐색(검색·더 보기), 알림(받은/보낸 요청), 모든 이미지 서명 주소로 표시.
  - 검증: 로컬 Postgres에서 `stage4_security_check.sql` 53개 통과 + 규칙을 일부러 망가뜨리면 13개 실패하는 것 확인(테스트가 진짜로 잡아냄) + 실제 storage.objects 행 단위 정책 확인. 빌드·lint 통과, 가짜 데이터로 화면 확인.
  - 사용자 할 일: 마이그레이션 실행, 보안 테스트 SQL 실행, 계정 2개로 화면 확인.
- [x] **5단계 디자인·편집기**: 레트로 픽셀 디자인(남색 별밤 + 크림 창 + 주황, 갈무리 글꼴) 전체 적용. 로그 편집기를 툴바 방식(TipTap)으로 교체, 글꼴 5종. 로그 본문 JSON 저장 + 허용 목록 정리, 예전 글 자동 변환. 로그 화면은 필요할 때만 불러옴(lazy).
  - 검증: `npm test` 21개 통과(javascript 링크·CSS 주입·외부 이미지·경로 조작 차단 등), 실제 브라우저에서 툴바 조작 → 저장되는 문서 확인(굵게·색·글꼴·정렬·표·예전 이미지 유지), 보기 화면에서 위험 링크 제거·외부 이미지 요청 0건 확인. 빌드·lint 통과.
  - 사용자 할 일: `20261114000001_log_body_limit.sql` 실행.
- [ ] 다음: Capacitor 안드로이드 APK
- [ ] 이후(선택): 캐릭터 순서 변경, 비밀번호 재설정

## 결정 사항 메모
- 캐릭터 visibility 기본값은 DB상 private(명세대로). 앱에서 캐릭터를 새로 만들 때는 위키의 공개 범위를 기본으로 넣어 줄 예정.
- 명세 외로 추가한 컬럼: wikis/rooms/characters/character_images/profiles 의 `created_at`.
- Capacitor는 화면이 생긴 뒤 단계에서 설치.
- (2단계) 모든 탭 화면은 로그인 필요. (4단계에서 모든 열람에 로그인 필수로 확정)
- (2단계) 화면 전체 로딩은 "로그인 상태 확인"에만. 프로필은 화면을 먼저 보여 준 뒤 채움(네트워크가 느려도 멈추지 않게).
- (2단계) 프로필 사진: 브라우저에서 256px 정사각형 webp로 줄여 `media/{user_id}/avatar/{uuid}.webp`에 업로드, 바꾸면 예전 파일 삭제. 원본 10MB 제한.
- (2단계) 이메일 인증이 켜져 있으면 가입 후 "메일함 확인" 화면. 인증 링크는 `window.location.origin`으로 돌아옴 → Supabase Auth의 Site URL / Redirect URLs 설정 필요. (Capacitor 앱용 딥링크는 안드로이드 단계에서)
- (2단계) 비밀번호 재설정은 아직 없음 (필요 시 추가).
- (3단계) 쿼리는 `data/` 에만. PostgREST 관계 자동 연결(embed)은 쓰지 않음 — characters↔character_images 사이에 FK가 두 개(character_id, 대표 이미지)라 모호해서. 필요한 건 쿼리를 나눠서 가져옴.
- (3단계) 캐릭터 저장(saveCharacter)은 여러 단계(기본 정보→항목→이미지 삭제→새 이미지 업로드→순서→대표 이미지). 중간 실패 시 일부만 저장될 수 있어 화면에 안내.
- (3단계) 대표 이미지를 안 고르면 첫 번째 이미지가 대표. 캐릭터당 이미지 최대 30장, 고르는 원본은 30MB까지(줄여서 올리므로).
- (3단계) 자주 쓰는 항목 이름 버튼(외모·성격·나이…)으로 빠르게 추가. 내용·이름이 모두 빈 항목은 저장 시 버림.
- (5단계) 로그 편집기를 툴바 방식으로 바꿈 → (3단계의 "긴 주소 한 줄" 문제 해결).
- (5단계) 표·구분선·이미지를 넣을 때 고른 글자를 지우지 않도록 선택 끝에 넣음 (테스트 중 발견해서 고침).
- (5단계) 제목 줄의 _ □ × 버튼은 꾸밈용(누를 수 없음). 하위 화면은 왼쪽 ◀ 버튼이 뒤로 가기.
- (3단계) 캐릭터 순서 변경 UI는 아직 없음 (방 안에서는 만든 순서).
- (3단계) JS 번들이 500kB를 넘어 빌드 경고가 남. 나중에 화면별로 나눠 불러오기(lazy) 고려.
- (4단계) "전체 공개"도 로그인 필요 (사용자 요구). 비로그인 열람 화면은 만들지 않음.
- (4단계) 링크 공개는 헤더 방식 대신 "링크를 열면 DB에 열람 기록(link_grants)"으로 구현 — Storage(이미지) 권한도 같은 규칙으로 판단하려면 로그인 사용자 기준이어야 해서. 기록은 그때의 토큰과 함께 저장되고, 위키의 현재 토큰과 같을 때만 유효.
- (4단계) 링크 공개 → 비공개 → 다시 링크 공개로 바꾸면(토큰 그대로) 예전에 링크로 들어온 사람도 다시 볼 수 있음. 완전히 막으려면 "새 링크 만들기".
- (4단계) 공개 범위를 바꿀 때 "모든 캐릭터에도 적용"(기본 켜짐). 새 캐릭터는 위키 공개 범위로 시작. 주인 화면에서 위키와 다른 공개 범위인 캐릭터 카드에 배지 표시.
- (4단계) 철회 = 요청 상태를 rejected 로 변경(기록 유지, "거절·철회한 요청"에서 다시 승인 가능). 요청자는 "다시 요청하기"(삭제 후 새 요청) 가능.
- (4단계) 탐색 검색: 제목에서 찾고, 볼 권한 있는 위키만 소개에서도 찾음(잠긴 위키 소개가 검색으로 새지 않게). 내 위키는 탐색에서 제외. 20개씩.
- (4단계) 알림 탭은 실시간 푸시가 아니라 열 때 불러오는 목록.
- 디자인: 기본 색 indigo-500, 화면 최대 폭 max-w-md, safe-area 여백 처리.
