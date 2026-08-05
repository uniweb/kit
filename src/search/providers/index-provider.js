/**
 * The `index` search provider — download a prebuilt index, query it locally.
 *
 * The free path, and the default. Works on any host, including a plain static
 * one with no server at all, which is why it stays the fallback for every other
 * provider (see `resolveProvider` in ../client.js).
 *
 * Its limit is structural rather than a quality gap: the index is built from
 * what existed at build time, so content that arrives from an API afterwards
 * cannot be in it. Fuzzy matching is the thing it does *better* than a server
 * scorer — Fuse tolerates typos.
 *
 * Fuse is imported dynamically so a site using a different provider never
 * bundles it.
 */

import { buildSnippet } from '../snippets.js'
import { emptyResult } from './result.js'

// In-memory caches, keyed by index URL. Module-scope is correct here: this
// only ever runs in one browser tab, unlike the edge's per-PoP isolates.
const indexCache = new Map()
const fuseCache = new Map()

// Bumped to v2 when stored entries gained a validator. The version is part of
// the key, so every v1 entry — which had no way to be revalidated and could
// outlive any number of rebuilds — is orphaned rather than trusted.
const STORAGE_VERSION = 'v2'
const STORAGE_PREFIX = 'uniweb:search:'
const STORAGE_KEY = (cacheKey) => `${STORAGE_PREFIX}${STORAGE_VERSION}:${cacheKey}`

/**
 * Default Fuse.js options optimized for site search
 */
const DEFAULT_FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'content', weight: 0.4 },
    { name: 'excerpt', weight: 0.3 },
    { name: 'pageTitle', weight: 0.2 }
  ],
  threshold: 0.35,
  includeMatches: true,
  // Exposed so ranking is inspectable, and so a foundation that wants its own
  // ordering has something to order by. Fuse omits `score` entirely without it,
  // which is why nothing could be ranked on relevance before.
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2
}

/**
 * Does this entry literally contain every word of the query?
 *
 * Fuse is approximate by design, and on fields the size of a whole page that
 * turns into a real problem: searching "inset" on a documentation site
 * returned 68 hits of which 4 contained the word, and all four ranked below
 * the tenth result — so every result the reader saw was a near-miss on a page
 * that never mentions the term.
 *
 * Fuzzy is the right FALLBACK — it is what tolerates a typo — but it must not
 * outrank an exact match. Checking containment directly is the cheap, honest
 * signal Fuse's score does not provide here.
 *
 * Every token must appear, so "Inset Components" does not match a page that
 * merely says "components". Matching is substring-based rather than
 * word-boundary so that "inset" still finds "insets".
 */
function literalTier(item, tokens) {
  if (!tokens.length) return 2

  const title = `${item.title || ''} ${item.pageTitle || ''}`.toLowerCase()
  if (tokens.every((t) => title.includes(t))) return 0

  const body = `${title} ${item.content || ''} ${item.excerpt || ''}`.toLowerCase()
  if (tokens.every((t) => body.includes(t))) return 1

  return 2
}

/**
 * Get localStorage safely (handles SSR and access errors)
 * @returns {Storage|null}
 */
function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Load index from localStorage
 * @param {string} cacheKey - Cache key
 * @returns {Object|null}
 */
function loadFromStorage(cacheKey) {
  const storage = getStorage()
  if (!storage) return null

  const raw = storage.getItem(STORAGE_KEY(cacheKey))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.payload?.entries)) return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Save index to localStorage, together with the validator that lets a later
 * load ask the server whether it is still current.
 *
 * @param {string} cacheKey - Cache key
 * @param {Object} payload - Index data
 * @param {{etag?: string|null, lastModified?: string|null}} [validator]
 */
function saveToStorage(cacheKey, payload, validator = {}) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(
      STORAGE_KEY(cacheKey),
      JSON.stringify({
        payload,
        etag: validator.etag || null,
        lastModified: validator.lastModified || null,
      })
    )
  } catch {
    // Ignore quota errors
  }
}

/**
 * Drop entries written by an older storage schema.
 *
 * A search index runs to hundreds of kilobytes, so an orphaned one is a real
 * bite out of a origin's storage quota rather than a tidiness issue.
 */
function pruneOldVersions() {
  const storage = getStorage()
  if (!storage) return

  const current = `${STORAGE_PREFIX}${STORAGE_VERSION}:`
  const stale = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(STORAGE_PREFIX) && !key.startsWith(current)) stale.push(key)
  }
  stale.forEach((key) => {
    try { storage.removeItem(key) } catch { /* ignore */ }
  })
}

/**
 * Load search index for a locale
 * @param {string} indexUrl - URL to fetch the index from
 * @param {Object} options - Options
 * @param {string} [options.cacheKey] - Cache key (defaults to indexUrl)
 * @param {boolean} [options.useStorage=true] - Use localStorage caching
 * @returns {Promise<Object>} Search index
 */
export async function loadSearchIndex(indexUrl, options = {}) {
  const { cacheKey = indexUrl, useStorage = true } = options

  // Memory cache: scoped to one page load, where the index cannot change
  // underneath us. This is the only cache read that needs no validation.
  if (indexCache.has(cacheKey)) {
    return indexCache.get(cacheKey)
  }

  if (useStorage) pruneOldVersions()
  const cached = useStorage ? loadFromStorage(cacheKey) : null

  // ALWAYS ask the server, even holding a stored copy.
  //
  // Returning the stored index unconditionally — what this did before — has no
  // expiry and no way to notice a rebuild, so a visitor who searched once kept
  // answering from that index for as long as the entry survived. A redeploy
  // did not dislodge it.
  //
  // It also collided across sites. The key is the index URL, which is
  // `/search-index.json` for every Uniweb project, and localStorage is scoped
  // to an origin — so two projects sharing a dev port shared one entry, and a
  // search on one could return the other's pages. Revalidating settles that
  // too: a different server answers 200 with its own index and replaces it.
  const headers = {}
  if (cached?.etag) headers['If-None-Match'] = cached.etag
  else if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified

  let response
  try {
    // `no-cache` = revalidate, not "don't cache". `force-cache` (the previous
    // value) told the browser to prefer any stored response regardless of age,
    // which defeated revalidation a second time over.
    response = await fetch(indexUrl, { headers, cache: 'no-cache' })
  } catch (error) {
    // Offline or unreachable. A stored index is better than no search at all,
    // and this is the one path where serving it unvalidated is the right call.
    if (cached) {
      indexCache.set(cacheKey, cached.payload)
      return cached.payload
    }
    throw error
  }

  // Unchanged since we stored it — the whole point of keeping the validator.
  if (response.status === 304 && cached) {
    indexCache.set(cacheKey, cached.payload)
    return cached.payload
  }

  if (!response.ok) {
    if (cached) {
      indexCache.set(cacheKey, cached.payload)
      return cached.payload
    }
    throw new Error(`Failed to load search index: ${response.status}`)
  }

  const payload = await response.json()

  indexCache.set(cacheKey, payload)
  if (useStorage) {
    // A host that sends no validator still gets stored — it just costs a full
    // fetch next time instead of a 304. What it never does is get served as
    // though it were known to be current.
    saveToStorage(cacheKey, payload, {
      etag: response.headers?.get?.('etag'),
      lastModified: response.headers?.get?.('last-modified'),
    })
  }

  return payload
}

/**
 * Clear all search caches
 * @param {string} [cacheKey] - Specific cache key to clear, or all if omitted
 */
export function clearSearchCache(cacheKey) {
  if (cacheKey) {
    indexCache.delete(cacheKey)
    fuseCache.delete(cacheKey)
    const storage = getStorage()
    if (storage) {
      storage.removeItem(STORAGE_KEY(cacheKey))
    }
  } else {
    indexCache.clear()
    fuseCache.clear()
    const storage = getStorage()
    if (storage) {
      // Clear all search-related storage
      const keysToRemove = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => storage.removeItem(key))
    }
  }
}

/**
 * Create an `index` provider bound to a Website.
 *
 * @param {Object} website - Website instance from @uniweb/core
 * @param {Object} [options]
 * @param {Object} [options.fuseOptions] - Custom Fuse.js options
 * @param {boolean} [options.useStorage=true] - Use localStorage caching
 * @returns {{query: Function, preload: Function, clearCache: Function}}
 */
export function createIndexProvider(website, options = {}) {
  const { fuseOptions = {}, useStorage = true } = options
  const mergedFuseOptions = { ...DEFAULT_FUSE_OPTIONS, ...fuseOptions }

  async function getFuse() {
    // Read the URL per call rather than closing over it: the active locale can
    // change without the client being rebuilt, and each locale has its own index.
    const indexUrl = website.getSearchIndexUrl()
    const cacheKey = indexUrl

    if (fuseCache.has(cacheKey)) {
      return fuseCache.get(cacheKey)
    }

    const index = await loadSearchIndex(indexUrl, { cacheKey, useStorage })

    let Fuse
    try {
      const fuseMod = await import('fuse.js')
      Fuse = fuseMod.default || fuseMod
    } catch {
      throw new Error(
        'Fuse.js is required for the `index` search provider. ' +
        'Install it with: npm install fuse.js'
      )
    }

    const fuse = new Fuse(index.entries || [], mergedFuseOptions)
    fuseCache.set(cacheKey, fuse)

    return fuse
  }

  return {
    async query(text, { limit = 10, type, route } = {}) {
      const fuse = await getFuse()
      let results = fuse.search(text)

      if (type) {
        results = results.filter(({ item }) => item.type === type)
      }
      if (route) {
        results = results.filter(({ item }) => item.route?.startsWith(route))
      }

      // Rank pages that actually contain the words above Fuse's near-misses.
      //
      // Fuse sorts by its own score, which on page-sized content fields rates
      // an approximate match as highly as an exact one — so a page containing
      // the search term could sit below ten pages that never mention it, and
      // the reader concludes the site has nothing on the subject.
      //
      // A stable sort by tier keeps Fuse's ordering *within* each tier, so
      // relevance still decides among equals and the fuzzy tail is preserved
      // rather than discarded. Applied before `limit`, because the cutoff is
      // exactly where the problem showed up.
      const tokens = String(text || '').toLowerCase().split(/\s+/).filter(Boolean)
      results = results
        .map((r, i) => ({ r, i, tier: literalTier(r.item, tokens) }))
        .sort((a, b) => a.tier - b.tier || a.i - b.i)
        .map(({ r }) => r)

      // Exact here, unlike the endpoint provider: the whole corpus is local, so
      // this counts every match after filtering and before the cut — the number
      // a "showing 10 of 47" needs, and 47 is knowable only on this side of the
      // slice.
      const total = results.length

      const page = results.slice(0, limit).map(({ item, matches }) => {
        const snippet = buildSnippet(item.content, matches, { key: 'content' })

        return {
          ...emptyResult(),
          id: item.id,
          type: item.type,
          route: item.route,
          sectionId: item.sectionId ?? null,
          anchor: item.anchor ?? null,
          href: item.anchor ? `${item.route}#${item.anchor}` : item.route,
          title: item.title ?? '',
          pageTitle: item.pageTitle ?? '',
          description: item.description ?? null,
          excerpt: item.excerpt ?? '',
          component: item.component ?? null,
          snippetText: snippet.text,
          snippetHtml: snippet.html,
          matches
        }
      })

      return { results: page, total }
    },

    async preload() {
      await getFuse()
    },

    clearCache() {
      clearSearchCache(website.getSearchIndexUrl())
    }
  }
}
