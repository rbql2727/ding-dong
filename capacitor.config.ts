import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor (안드로이드 앱) 설정
 * - 웹 빌드 결과(dist)를 앱 안에 넣어서 실행합니다.
 * - 바꾼 뒤에는 `npm run android:sync` 로 안드로이드 프로젝트에 반영하세요.
 */
const config: CapacitorConfig = {
  appId: 'com.ocwk.app', // 앱 고유 이름 (스토어에 올린 뒤에는 바꾸기 어려움)
  appName: 'OCWK', // 폰에 보이는 앱 이름 (임시)
  webDir: 'dist',
  backgroundColor: '#171c36', // 앱이 뜨는 순간 배경 (밤하늘 남색)
  plugins: {
    SystemBars: {
      // 상태표시줄·내비게이션 바 영역을 CSS env(safe-area-inset-*) 로 처리 (화면 위아래 여백)
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      // 남색 화면이므로 상태표시줄 글자·아이콘은 밝게
      style: 'DARK',
    },
  },
}

export default config
