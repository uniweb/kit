/**
 * useWebsiteState — React bridge into the Website's ObservableState.
 *
 * Sibling of `usePageState` but scoped site-wide rather than per-page.
 * Typical uses: active appearance ('light'/'dark'/'system'), authenticated
 * user, cross-page selections (a filter chosen on /search that other
 * pages honor).
 *
 * Same contract: reads on render, subscribes to the keyed slot, re-renders
 * when the value changes, writes via `website.state.set(key, value)`.
 *
 * @param {string} key
 * @param {*} [defaultValue]
 * @returns {[any, (value: any) => void]}
 */

import { useEffect, useReducer } from 'react'
import { useWebsite } from './useWebsite.js'

function forceTick(n) {
  return n + 1
}

export function useWebsiteState(key, defaultValue) {
  const { website } = useWebsite()
  const [, tick] = useReducer(forceTick, 0)
  const state = website?.state

  useEffect(() => {
    if (!state) return
    return state.subscribe(key, tick)
  }, [state, key])

  const value = state?.has(key) ? state.get(key) : defaultValue

  const setValue = (next) => {
    if (!state) return
    state.set(key, typeof next === 'function' ? next(value) : next)
  }

  return [value, setValue]
}

export default useWebsiteState
