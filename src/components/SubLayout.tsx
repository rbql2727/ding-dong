import { Outlet } from 'react-router-dom'

/** 하위 화면(위키·캐릭터·로그) 공통 틀: 하단 탭 없이 폰 폭으로 */
export function SubLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-white">
      <Outlet />
    </div>
  )
}
