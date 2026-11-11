import { App as CapApp } from '@capacitor/app'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { runTopBackHandler } from '../lib/backStack'

/** 하단 탭 화면들 (여기서 뒤로가기 → 홈으로, 홈에서 뒤로가기 → 앱 내리기) */
const ROOT_PATHS = ['/explore', '/wikis', '/notifications', '/profile']
const EXIT_PATHS = ['/', '/login', '/signup']

/**
 * 안드로이드 앱(Capacitor)에서만 동작하는 연결부. 웹에서는 아무것도 안 함.
 * - 상태표시줄: 밝은 글자(남색 화면용)
 * - 뒤로가기 버튼: 열린 창 닫기 → 이전 화면 → (탭 화면이면) 홈 → (홈이면) 앱 내리기
 */
export function NativeBridge() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)

  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void SystemBars.setStyle({ style: SystemBarsStyle.Dark })

    const listener = CapApp.addListener('backButton', () => {
      if (runTopBackHandler()) return
      const path = pathRef.current
      if (EXIT_PATHS.includes(path)) {
        void CapApp.minimizeApp()
        return
      }
      if (ROOT_PATHS.includes(path)) {
        navigate('/')
        return
      }
      // React Router 가 기록해 둔 "몇 번째 화면인지"(idx) — 0 이면 앱을 이 화면에서 시작한 것
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (idx > 0) navigate(-1)
      else navigate('/', { replace: true })
    })
    return () => {
      void listener.then((l) => l.remove())
    }
  }, [navigate])

  return null
}
