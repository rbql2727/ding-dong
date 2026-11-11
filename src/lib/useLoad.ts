import { useCallback, useEffect, useState } from 'react'

type LoadState<T> = { depsKey: string; version: number; data?: T; error?: string }

/**
 * 화면에 필요한 데이터를 불러오는 작은 도우미.
 *
 *   const { data, loading, error, reload, setData } = useLoad(() => getWiki(id), [id])
 *
 * - deps 가 바뀌면 새로 불러옵니다 (예전 데이터는 버림).
 * - reload() 는 지금 데이터를 보여 주는 채로 다시 불러옵니다.
 * - setData() 로 화면의 데이터를 바로 고칠 수 있습니다 (저장 직후 반영 등).
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const depsKey = JSON.stringify(deps)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<LoadState<T>>({ depsKey: '', version: -1 })

  useEffect(() => {
    let cancelled = false
    fn().then(
      (data) => !cancelled && setState({ depsKey, version, data }),
      (err: Error) =>
        !cancelled && setState({ depsKey, version, error: err?.message || '불러오지 못했어요.' }),
    )
    return () => {
      cancelled = true
    }
    // fn 은 매번 새로 만들어지므로 deps 로 판단합니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, version])

  const sameDeps = state.depsKey === depsKey
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const setData = useCallback(
    (updater: (prev: T) => T) =>
      setState((s) => (s.data === undefined ? s : { ...s, data: updater(s.data) })),
    [],
  )

  return {
    data: sameDeps ? state.data : undefined,
    error: sameDeps && state.version === version ? state.error : undefined,
    loading: !sameDeps || (state.version !== version && state.data === undefined),
    reload,
    setData,
  }
}
