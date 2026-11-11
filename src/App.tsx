import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './auth/routes'
import { AppLayout } from './components/AppLayout'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ProfilePage } from './pages/tabs/ProfilePage'
import { ExplorePage, HomePage, MyWikisPage, NotFoundPage, NotificationsPage } from './pages/tabs/TabPages'

/**
 * 화면 주소(라우트) 목록
 *  - /login, /signup      : 로그인 안 한 사람만
 *  - 나머지 탭 화면        : 로그인한 사람만 (안 했으면 /login 으로)
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
