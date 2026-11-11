import { useEffect, useRef } from 'react'

/**
 * 안드로이드 "뒤로가기" 버튼 처리 순서
 *   1) 열려 있는 창(모달·자르기·이미지 크게 보기)이 있으면 → 맨 위 창부터 닫기
 *   2) 없으면 → 이전 화면으로 (NativeBridge.tsx 에서 처리)
 *
 * 창 컴포넌트는 useBackHandler(열려있음, 닫기함수) 만 부르면 됩니다.
 */
const stack: { id: number; handler: () => void }[] = []
let nextId = 1

/** 맨 위 창의 닫기 함수를 실행. 처리했으면 true */
export function runTopBackHandler(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top.handler()
  return true
}

export function useBackHandler(active: boolean, handler: () => void) {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    if (!active) return
    const id = nextId++
    stack.push({ id, handler: () => latest.current() })
    return () => {
      const i = stack.findIndex((h) => h.id === id)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [active])
}
