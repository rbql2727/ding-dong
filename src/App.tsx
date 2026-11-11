import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './auth/routes'
import { AppLayout } from './components/AppLayout'
import { SubLayout } from './components/SubLayout'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { CharacterDetailPage } from './pages/character/CharacterDetailPage'
import { CharacterFormPage } from './pages/character/CharacterFormPage'
import { LogDetailPage, LogEditorPage } from './pages/log/LogPages'
import { ProfilePage } from './pages/tabs/ProfilePage'
import { ExplorePage, HomePage, NotFoundPage, NotificationsPage } from './pages/tabs/TabPages'
import { MyWikisPage } from './pages/wiki/MyWikisPage'
import { WikiCreatePage, WikiSettingsPage } from './pages/wiki/WikiFormPage'
import { WikiHomePage } from './pages/wiki/WikiHomePage'

/**
 * 화면 주소(라우트) 목록
 *  - /login, /signup                    : 로그인 안 한 사람만
 *  - 하단 탭 화면 (/, /explore, /wikis…) : 로그인 필요, 하단 탭 있음
 *  - 위키·캐릭터·로그 화면 (/w/…)        : 로그인 필요, 하단 탭 없음 (뒤로 가기)
 */
function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/wikis" element={<MyWikisPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route element={<SubLayout />}>
          <Route path="/wikis/new" element={<WikiCreatePage />} />
          <Route path="/w/:wikiId" element={<WikiHomePage />} />
          <Route path="/w/:wikiId/settings" element={<WikiSettingsPage />} />
          <Route path="/w/:wikiId/c/new" element={<CharacterFormPage />} />
          <Route path="/w/:wikiId/c/:charId" element={<CharacterDetailPage />} />
          <Route path="/w/:wikiId/c/:charId/edit" element={<CharacterFormPage />} />
          <Route path="/w/:wikiId/c/:charId/logs/new" element={<LogEditorPage />} />
          <Route path="/w/:wikiId/c/:charId/logs/:logId" element={<LogDetailPage />} />
          <Route path="/w/:wikiId/c/:charId/logs/:logId/edit" element={<LogEditorPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

/** .env 에 키가 없을 때 안내 */
function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold">설정이 필요해요</h1>
      <p className="text-sm text-gray-600">
        프로젝트 폴더의 <code className="rounded bg-gray-100 px-1">.env</code> 파일에 Supabase 주소와 키를 넣고
        개발 서버를 다시 켜 주세요. (<code className="rounded bg-gray-100 px-1">.env.example</code> 참고)
      </p>
    </main>
  )
}

export default App
