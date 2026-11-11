import { NavLink, Outlet } from 'react-router-dom'
import { BellIcon, BookIcon, CompassIcon, HomeIcon, UserIcon } from './icons'

const TABS = [
  { to: '/', label: '홈', Icon: HomeIcon, end: true },
  { to: '/explore', label: '탐색', Icon: CompassIcon, end: false },
  { to: '/wikis', label: '내 위키', Icon: BookIcon, end: false },
  { to: '/notifications', label: '알림', Icon: BellIcon, end: false },
  { to: '/profile', label: '프로필', Icon: UserIcon, end: false },
]

/** 로그인 후 화면의 공통 틀: 위쪽은 각 화면 내용, 아래쪽은 탭 */
export function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-white">
      {/* 하단 탭에 내용이 가려지지 않도록 아래 여백 */}
      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {TABS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-indigo-500' : 'text-gray-400 active:text-gray-600'
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
    </div>
  )
}
