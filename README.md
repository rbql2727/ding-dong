# OC 위키 (OCWK)

🌐 웹: https://ding-dong-eight.vercel.app

자작 캐릭터(OC)를 위키 형태로 정리하는 앱입니다. 웹 + 안드로이드 앱.
(React + Vite + TypeScript + Tailwind + Supabase + Capacitor)

## 처음 실행하기 (내 PC에서)

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
5. 브라우저에서 http://localhost:5173 을 엽니다.

> 폰 브라우저로 미리 보기: PC와 폰이 같은 와이파이일 때 `npm run dev -- --host` 로 켜고, 화면에 나오는 `Network:` 주소로 접속.

## Supabase 설정

### 1) 키 넣기
Supabase 대시보드 → 프로젝트 선택 → **Project Settings → API** (또는 **API Keys**)

| .env 이름 | 넣을 값 |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` 키 또는 Publishable key (`sb_publishable_...`) |
| `VITE_PUBLIC_SITE_URL` | (선택) 웹을 배포한 주소. 공유 링크·인증 메일 링크에 사용. **안드로이드 앱 빌드할 때는 넣는 것을 추천** |

> ⚠️ `service_role` / `secret` 키는 절대 넣지 마세요.

### 2) SQL 적용 (테이블 만들기)
대시보드 왼쪽 메뉴 **SQL Editor → New query** 에서 아래 파일을 **순서대로** 하나씩 열어 내용을 전부 복사 → 붙여넣기 → **Run**.

1. `supabase/migrations/20261111000001_tables.sql`
2. `supabase/migrations/20261111000002_rls.sql`
3. `supabase/migrations/20261111000003_storage.sql`
4. `supabase/migrations/20261112000001_profiles_backfill.sql`
5. `supabase/migrations/20261113000001_sharing_security.sql`
6. `supabase/migrations/20261114000001_log_body_limit.sql`

"Success" 가 나오면 성공. "already exists" 오류는 이미 적용된 것이니 다음 파일로 넘어가면 됩니다.

### 3) 로그인 설정 (Authentication → URL Configuration)
- **Site URL**: 웹 배포 주소 (배포 전에는 `http://localhost:5173`)
- **Redirect URLs**: `http://localhost:5173`, 웹 배포 주소 둘 다 추가
- 테스트 중 인증 메일이 번거로우면 **Sign In / Providers → Email → "Confirm email" 끄기** (실제 서비스 전에는 다시 켜기)

---

## 안드로이드 APK 만들기

### 방법 A. GitHub 클라우드에서 빌드 (설치할 것 없음, 추천)
1. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret** 에 3개를 넣습니다.
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, (선택) `VITE_PUBLIC_SITE_URL`
2. 저장소 → **Actions** 탭 → 왼쪽 **"Android 디버그 APK"** → **Run workflow** → 초록 버튼
   (main 에 코드를 올릴 때도 자동으로 돌아요)
3. 5~10분 뒤 실행 기록을 누르고 맨 아래 **Artifacts → `ocwk-debug-apk`** 를 내려받아 압축을 풀면 **`app-debug.apk`**

### 방법 B. 내 PC에서 빌드 (Android Studio 없이, Windows 기준 최소 설치)
1. **Java 21 (JDK)** 설치 — PowerShell 에서:
   ```bash
   winget install EclipseAdoptium.Temurin.21.JDK
   ```
2. **안드로이드 명령줄 도구(Command line tools only)** 내려받기
   https://developer.android.com/studio#command-tools → Windows 용 zip
   압축을 풀어서 폴더 구조가 `C:\Android\cmdline-tools\latest\bin\sdkmanager.bat` 이 되게 놓습니다.
   (zip 안의 `cmdline-tools` 폴더를 `latest` 로 이름 바꿔서 `C:\Android\cmdline-tools\` 안에 넣기)
3. 환경 변수 설정 (PowerShell, 한 번만) — 설정 후 **터미널을 새로 열기**:
   ```bash
   setx ANDROID_HOME "C:\Android"
   ```
4. 필요한 부품 설치 + 라이선스 동의 (새 터미널에서):
   ```bash
   C:\Android\cmdline-tools\latest\bin\sdkmanager.bat "platform-tools" "platforms;android-36" "build-tools;36.0.0"
   ```
   ```bash
   C:\Android\cmdline-tools\latest\bin\sdkmanager.bat --licenses
   ```
   (질문마다 `y` 입력)
5. 빌드 (프로젝트 폴더에서):
   ```bash
   npm run android:apk
   ```
   맥/리눅스는 `npm run android:sync` 후 `cd android && ./gradlew assembleDebug`

**만들어진 APK 위치:** `android\app\build\outputs\apk\debug\app-debug.apk`

### 폰에 설치하기
- APK 파일을 폰으로 옮겨서(카톡 나에게 보내기, 구글 드라이브, USB 등) 누르면 설치됩니다.
- "출처를 알 수 없는 앱" 허용을 물으면 허용하세요. (디버그 APK 라 Play 프로텍트 경고가 뜰 수 있어요 → "무시하고 설치")
- 새 버전을 설치하면 기존 앱 위에 덮어써집니다 (같은 PC/같은 클라우드 빌드 기준).

### 앱에서 달라지는 점
- 뒤로가기 버튼: 열린 창 닫기 → 이전 화면 → (탭 화면) 홈 → (홈) 앱 내리기
- 상태표시줄: 남색 화면에 맞춰 밝은 글자, 화면 위아래 여백 자동 처리
- 사진 올리기: 폰 갤러리(사진 선택기)에서 고르기, 여러 장 선택 가능

---

## 웹 배포

`npm run build` 결과(`dist` 폴더)를 올리는 정적 사이트입니다. 두 서비스 모두 무료 요금제로 충분해요.
**배포 후 꼭 할 일:** ① Supabase → Authentication → URL Configuration 에 배포 주소 추가 ② `.env`·GitHub Secrets 의 `VITE_PUBLIC_SITE_URL` 에 배포 주소 넣기

### Vercel
1. https://vercel.com 에 GitHub 로 로그인 → **Add New → Project** → `ding-dong` 저장소 **Import**
2. Framework: **Vite** (자동 인식), Build Command `npm run build`, Output `dist` (이미 `vercel.json` 에 설정됨)
3. **Environment Variables** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL` 추가
4. **Deploy** → `https://<이름>.vercel.app` 주소가 생깁니다. 이후 main 에 올릴 때마다 자동 배포.
   - 이름에 `KEY` 가 들어간 변수에 "공개되는 값" 경고가 뜨면: publishable 키는 공개용이라 괜찮으니 변수 종류를 **Config** 로 (앞의 `VITE_` 는 지우지 마세요)

### Cloudflare Pages
1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → 저장소 선택
2. Framework preset: **Vite** (또는 직접: Build command `npm run build`, Output directory `dist`)
3. **Environment variables** 에 위 3개 추가 → **Save and Deploy**
4. `https://<이름>.pages.dev` 주소가 생깁니다. (새로고침해도 화면이 뜨도록 `public/_redirects` 에 설정되어 있음)

---

## 테스트
- `npm test` — 로그 본문 보안 정리 테스트
- `supabase/tests/stage4_security_check.sql` — 공개 범위·승인 보안 테스트 (SQL Editor 에서 실행)
- `supabase/tests/two_accounts_check.sql` — 계정 2개 기본 권한 테스트
