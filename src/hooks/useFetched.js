/**
 * useFetched — imperative Layer-3 fetch hook.
 *
 * Shares the DataStore keyspace with Layer-1 (`content.data.*`) fetches.
 * A declarative fetch for the same request warms the cache; this hook
 * gets a synchronous cache hit on first render.
 *
 * Surface is intentionally narrow — no retries, no refetch intervals,
 * no stale-while-revalidate. If you need those, reach for a
 * purpose-built library and compose it around your own fetch.
 *
 * @example
 * function ProductCard({ params }) {
 *   const { data, error, loading } = useFetched({
 *     url: params.productUrl,
 *     transform: 'data.product',
 *   })
 *   if (loading) return <Skeleton />
 *   if (error) return <Error message={error} />
 *   return <Product {...data} />
 * }
 */

import { useEffect, useState } from 'react'
import { getUniweb, deriveCacheKey } from '@uniweb/core'

function emptyState() {
  return { data: null, error: null, loading: false }
}

function loadingState() {
  return { data: null, error: null, loading: true }
}

function readyState(data) {
  return { data, error: null, loading: false }
}

function errorState(error, data = null) {
  return { data, error, loading: false }
}

/**
 * @param {Object|null} request - A fetch request spec (path / url / schema / ...).
 *   Pass null/undefined to skip — the hook returns `{ data: null, error: null,
 *   loading: false }` without subscribing or dispatching.
 * @returns {{ data: any, error: string|null, loading: boolean }}
 */
export function useFetched(request) {
  const website = getUniweb()?.activeWebsite ?? null

  // Cache key is also the React dep. Serialized JSON so prop-identity-
  // changes that don't affect the key don't re-run the effect.
  const key = request && website ? deriveCacheKey(request) : null

  // Synchronous hit on first render.
  const initial = key ? website.dataStore.get(key) : null
  const [state, setState] = useState(() =>
    initial ? readyState(initial.data) : (key ? loadingState() : emptyState()),
  )

  useEffect(() => {
    if (!key || !website) {
      setState(emptyState())
      return undefined
    }

    // Re-check cache after mount: the key may have changed between
    // render and effect, or a parallel Layer-1 fetch may have landed.
    const cached = website.dataStore.get(key)
    if (cached) {
      setState(readyState(cached.data))
    } else {
      setState(loadingState())
    }

    // Subscribe first so a concurrent Layer-1 fetch's cache write
    // wakes this hook even if our own dispatch is still in flight.
    const unsubscribe = website.dataStore.subscribe(key, () => {
      const entry = website.dataStore.get(key)
      if (entry) setState(readyState(entry.data))
    })

    const controller = new AbortController()
    website.fetcher
      .dispatch(request, { website, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        if (result?.error) {
          setState(errorState(result.error, result.data ?? null))
          return
        }
        // Successful results typically arrive via the subscription (the
        // dispatcher writes to cache and fires listeners). Fall through
        // here to handle cached-hit and null-data paths so a useFetched
        // caller never sits in `loading: true` when dispatch returns.
        if (result && 'data' in result) {
          setState(readyState(result.data))
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setState(errorState(String(err?.message || err)))
      })

    return () => {
      controller.abort()
      unsubscribe()
    }
  }, [key, website])

  return state
}

export default useFetched
