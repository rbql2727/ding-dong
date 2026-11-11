import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullScreenLoading } from '../components/ui'

/** 로그인해야 들어갈 수 있는 화면들. 로그인 안 했으면 /login 으로 보냄 */
export function ProtectedRoute() {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoading />
  if (!user) {
    // 로그인 후 원래 가려던 곳으로 돌아오도록 위치를 기억
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** 로그인/회원가입 화면. 이미 로그인했으면 홈으로 보냄 */
export function PublicOnlyRoute() {
  const { loading, user } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (loading) return <FullScreenLoading />
  if (user) return <Navigate to={from} replace />
  return <Outlet />
}
