/**
 * useCacheEntry — read-only observation of a DataStore entry.
 *
 * Subscribes to a cache key without triggering a fetch. Returns null
 * while the entry is absent; `{ data, meta }` once it's populated.
 * Used for components that want to display data someone else fetched
 * (e.g., an "articles count" shown in a header while the main page
 * fetches the collection).
 *
 * Pairs with useFetched: useFetched triggers the dispatch and fills
 * the cache; useCacheEntry reads it. They share the same keyspace.
 *
 * @example
 * function ArticlesCount() {
 *   const entry = useCacheEntry({ path: '/data/articles.json', schema: 'articles' })
 *   if (!entry) return null
 *   return <span>{entry.data.length} articles</span>
 * }
 */

import { useEffect, useState } from 'react'
import { getUniweb, deriveCacheKey } from '@uniweb/core'

/**
 * @param {Object|null} request - A fetch request spec. Pass null/undefined
 *   to skip (returns null without subscribing).
 * @returns {{ data: any, meta?: Object } | null}
 */
export function useCacheEntry(request) {
  const website = getUniweb()?.activeWebsite ?? null
  const key = request && website ? deriveCacheKey(request) : null

  const [entry, setEntry] = useState(() =>
    key ? website.dataStore.get(key) : null,
  )

  useEffect(() => {
    if (!key || !website) {
      setEntry(null)
      return undefined
    }

    setEntry(website.dataStore.get(key))
    const unsubscribe = website.dataStore.subscribe(key, () => {
      setEntry(website.dataStore.get(key))
    })
    return unsubscribe
  }, [key, website])

  return entry
}

export default useCacheEntry
