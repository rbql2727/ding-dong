# OC 위키

자작 캐릭터(OC)를 위키 형태로 정리하는 앱입니다. (React + Vite + TypeScript + Tailwind + Supabase)

## 처음 실행하기

1. Node.js 20 이상을 설치합니다.
2. 패키지를 설치합니다.
   ```bash
   npm install
   ```
3. `.env.example` 을 복사해 `.env` 를 만들고 Supabase 키를 넣습니다. (아래 "Supabase 설정" 참고)
4. 개발 서버를 켭니다.
   ```bash
   npm run dev
   ```
5. 브라우저에서 http://localhost:5173 을 엽니다. "Supabase 연결 성공!" 이 보이면 준비 완료입니다.

## Supabase 설정

### 1) 키 넣기
Supabase 대시보드 → 프로젝트 선택 → **Project Settings → API** (또는 **Data API / API Keys**)

| .env 이름 | 넣을 값 |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` 키 또는 Publishable key (`sb_publishable_...`) |

> ⚠️ `service_role` / `secret` 키는 절대 넣지 마세요.

### 2) SQL 적용 (테이블 만들기)
대시보드 왼쪽 메뉴 **SQL Editor → New query** 에서 아래 파일을 **순서대로** 하나씩 열어 내용을 전부 복사 → 붙여넣기 → **Run**.

1. `supabase/migrations/20261111000001_tables.sql`
2. `supabase/migrations/20261111000002_rls.sql`
3. `supabase/migrations/20261111000003_storage.sql`
4. `supabase/migrations/20261112000001_profiles_backfill.sql` (2단계, 여러 번 실행해도 안전)

각각 "Success. No rows returned" 가 나오면 성공입니다. **같은 파일을 두 번 실행하면 "already exists" 오류가 납니다** — 이미 적용된 것이니 다음 파일로 넘어가면 됩니다.

### 3) 로그인 설정 (Authentication)
- **Authentication → URL Configuration → Site URL**: `http://localhost:5173` (배포하면 실제 주소로)
- **Redirect URLs**에도 `http://localhost:5173` 추가
- 테스트할 때 인증 메일이 번거로우면: **Authentication → Sign In / Providers → Email → "Confirm email" 끄기**
  (Supabase 기본 메일은 시간당 보낼 수 있는 개수가 적어요. 실제 서비스 전에는 다시 켜세요.)

## 계정 2개로 권한 확인하기
1. 일반 창에서 계정 A로 가입·로그인 → 프로필에서 닉네임/사진 변경
2. **시크릿 창**(다른 브라우저도 OK)에서 계정 B로 가입·로그인 → B의 프로필에는 B 정보만 보이는지 확인
3. 서버에서도 막히는지 확인: `supabase/tests/two_accounts_check.sql` 을 열어 위쪽 이메일 두 개를 A, B 이메일로 바꾼 뒤
   SQL Editor 에 붙여넣고 Run → 결과 표의 **통과** 칸이 모두 `true` 면 성공 (테스트 데이터는 자동 삭제)
