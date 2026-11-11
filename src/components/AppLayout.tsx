import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BellIcon, BookIcon, CompassIcon, HomeIcon, UserIcon } from './icons'
import { Avatar } from './ui'

const TABS = [
  { to: '/', label: '홈', Icon: HomeIcon, end: true },
  { to: '/explore', label: '탐색', Icon: CompassIcon, end: false },
  { to: '/wikis', label: '내 위키', Icon: BookIcon, end: false },
  { to: '/notifications', label: '알림', Icon: BellIcon, end: false },
  { to: '/profile', label: '프로필', Icon: UserIcon, end: false },
]

/**
 * 앱 공통 틀
 * - 폰(좁은 화면): 세로 한 줄. 탭 화면이면 아래쪽에 탭 막대.
 * - 넓은 화면(가로 1024px 이상): 가로형. 왼쪽에 메뉴, 오른쪽에 넓은 내용 영역.
 */
function Shell({ mobileTabs }: { mobileTabs: boolean }) {
  return (
    <div className="app-frame mx-auto max-w-md lg:flex lg:max-w-6xl">
      <SideNav />

      <div className="min-w-0 flex-1">
        {/* 폰에서는 아래 탭에 내용이 가려지지 않도록 여백 */}
        <main className={mobileTabs ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0' : ''}>
          <Outlet />
        </main>
      </div>

      {mobileTabs && <BottomTabs />}
    </div>
  )
}

/** 탭 화면(홈·탐색·내 위키·알림·프로필) */
export function AppLayout() {
  return <Shell mobileTabs />
}

/** 하위 화면(위키·캐릭터·로그): 폰에서는 탭 없이 뒤로 가기 */
export function SubLayout() {
  return <Shell mobileTabs={false} />
}

/** 넓은 화면 전용 왼쪽 메뉴 */
function SideNav() {
  const { profile } = useAuth()
  return (
    <aside className="hidden w-60 shrink-0 border-r-3 border-ink bg-gray-50 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="px-titlebar flex h-14 shrink-0 items-center px-4">
          <span className="font-title text-xl">OC_WIKI.exe</span>
        </div>
        <nav aria-label="주요 메뉴" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {TABS.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 border-2 px-3 py-2.5 font-bold ${
                      isActive
                        ? 'border-ink bg-ink text-paper shadow-[3px_3px_0_0_var(--color-accent)]'
                        : 'border-transparent text-ink hover:border-ink hover:bg-paper'
                    }`
                  }
                >
                  <Icon className="size-5" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {profile && (
          <NavLink to="/profile" className="flex items-center gap-2 border-t-3 border-dashed border-gray-300 p-3 hover:bg-paper">
            <Avatar url={profile.avatar_url} name={profile.nickname} className="size-9 text-sm" />
            <span className="min-w-0 truncate text-sm font-bold">{profile.nickname}</span>
          </NavLink>
        )}
      </div>
    </aside>
  )
}

/** 폰 전용 아래 탭 막대 */
function BottomTabs() {
  return (
    <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-20 bg-ink pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 border-t-3 border-accent bg-ink">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? 'bg-accent text-paper' : 'text-dim active:text-paper'
                }`
              }
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
