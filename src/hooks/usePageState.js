/**
 * usePageState — React bridge into the active page's ObservableState.
 *
 * Reads `page.state.get(key)` on render and subscribes to changes so
 * React re-renders when the value flips. The setter writes back through
 * `page.state.set(key, value)` — one source of truth, readable from
 * outside React (the fetcher, sibling components, persistence helpers).
 *
 * Scope: the *active* page's state. Navigating to a different page
 * swaps the observed scope; the new page's state is read instead.
 * That's usually what foundations want (filters don't carry across
 * pages). For site-wide state use `useWebsiteState`.
 *
 * @param {string} key - The key on page.state.
 * @param {*} [defaultValue] - Returned when the key has never been set.
 * @returns {[any, (value: any) => void]} [value, setValue]
 *
 * @example
 *   const [slug, setSlug] = usePageState('selectedQuery', 'all')
 *   return <select value={slug} onChange={e => setSlug(e.target.value)}>{...}</select>
 */

import { useEffect, useReducer } from 'react'
import { useWebsite } from './useWebsite.js'

function forceTick(n) {
  return n + 1
}

export function usePageState(key, defaultValue) {
  const { website } = useWebsite()
  const [, tick] = useReducer(forceTick, 0)

  const page = website.activePage
  const state = page?.state

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

export default usePageState
