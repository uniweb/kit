/**
 * The `index` search provider — download a prebuilt index, query it locally.
 *
 * The free path, and the default. Works on any host, including a plain static
 * one with no server at all, which is why it stays the fallback for every other
 * provider (see `resolveProvider` in ../client.js).
 *
 * Its limit is structural rather than a quality gap: the index is built from
 * what existed at build time, so content that arrives from an API afterwards
 * cannot be in it.
 *
 * ## ⭐ IT RANKS WITH THE SHARED ENGINE — 2026-09-06
 *
 * `@uniweb/projections/search` scores this, and it is the same engine a server
 * that answers search runs. **One site therefore ranks the same wherever it is
 * served**, which it did not before: this provider used Fuse.js and a server
 * lane used BM25F, so the same query over the same content came back in a
 * different order depending on who answered it. A reader experiences that as
 * the product being inconsistent, not as two implementations.
 *
 * What changes for a visitor, stated rather than implied:
 *
 * | | before (Fuse) | now |
 * |---|---|---|
 * | ranking | approximate score, with a literal-containment tier bolted on top to stop near-misses outranking real matches | BM25F with tf and IDF — a word on every page ranks itself down, so the tier is unnecessary rather than patched |
 * | typos | tolerated everywhere, competing with exact matches | tolerated as a FALLBACK that runs only when nothing matched, so a near-miss can never outrank a real hit |
 * | CJK, diacritics | whitespace tokenization; `café` ≠ `cafe`, and an unspaced script is one token | bigrams for unspaced scripts, NFKC/NFD folding — a global product's defaults |
 * | dependency | `fuse.js`, dynamically imported | none; the engine is a leaf of a package already in the graph |
 *
 * ⛔ **What it does NOT change is the download.** The whole entry set still
 * crosses the wire, because the entries are what a result renders from — title,
 * route, excerpt. On a site large enough for that to hurt, the answer is a host
 * that answers search (the `endpoint` provider), not a better client scorer.
 * Saying otherwise would be selling a scaling fix this is not.
 *
 * The engine is imported dynamically, as Fuse was, so a site on another provider
 * never loads it.
 */

import { buildSnippet } from '../snippets.js'
import { emptyResult } from './result.js'

// In-memory caches, keyed by index URL. Module-scope is correct here: this
// only ever runs in one browser tab, unlike the edge's per-PoP isolates.
const indexCache = new Map()
const structureCache = new Map()

// Bumped to v2 when stored entries gained a validator. The version is part of
// the key, so every v1 entry — which had no way to be revalidated and could
// outlive any number of rebuilds — is orphaned rather than trusted.
const STORAGE_VERSION = 'v2'
const STORAGE_PREFIX = 'uniweb:search:'
const STORAGE_KEY = (cacheKey) => `${STORAGE_PREFIX}${STORAGE_VERSION}:${cacheKey}`

/**
 * Where in the ORIGINAL text a query term first appears, in the shape
 * `buildSnippet` reads.
 *
 * ⛔ **THE ENGINE CANNOT SUPPLY THIS, AND SHOULD NOT.** It scores a whole corpus;
 * computing highlight offsets for every candidate would be exactly the work that
 * inverting the index exists to avoid. This runs for the handful of results
 * actually shown.
 *
 * ⚠️ **Deliberately matched against the RAW text, case-insensitively, not against
 * the engine's folded form.** Folding changes lengths — a `ﬁ` ligature becomes
 * two characters — so an offset computed on folded text points at the wrong span
 * in the string being highlighted. A term that only matches after folding (a
 * diacritic difference, or a fuzzy correction) therefore finds no offset, and the
 * snippet falls back to a plain truncation — which is what it already did when
 * nothing matched. **Degrading to the existing behaviour is the right failure**;
 * the alternative is a highlight on the wrong characters.
 */
function matchIndices(item, tokens) {
  const text = String(item?.content ?? '')
  if (!text || !tokens.length) return undefined
  const hay = text.toLowerCase()
  const indices = []
  for (const t of tokens) {
    const at = hay.indexOf(t)
    if (at >= 0) indices.push([at, at + t.length - 1])
  }
  if (!indices.length) return undefined
  indices.sort((a, b) => a[0] - b[0])
  return [{ key: 'content', indices }]
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
    structureCache.delete(cacheKey)
    const storage = getStorage()
    if (storage) {
      storage.removeItem(STORAGE_KEY(cacheKey))
    }
  } else {
    indexCache.clear()
    structureCache.clear()
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
 * @param {boolean} [options.useStorage=true] - Use localStorage caching
 * @returns {{query: Function, preload: Function, clearCache: Function}}
 */
export function createIndexProvider(website, options = {}) {
  const { useStorage = true } = options

  async function getEngine() {
    // Read the URL per call rather than closing over it: the active locale can
    // change without the client being rebuilt, and each locale has its own index.
    const indexUrl = website.getSearchIndexUrl()
    const cacheKey = indexUrl

    if (structureCache.has(cacheKey)) {
      return structureCache.get(cacheKey)
    }

    const index = await loadSearchIndex(indexUrl, { cacheKey, useStorage })

    const entries = index.entries || []
    // ⛔ THE LEAF, NOT THE BARREL. `@uniweb/projections/search` re-exports the
    // build-time generators too, and `extract.js` reaches `insets.js` and
    // `pages.js` — site-content extraction a browser search box has no use for.
    // `engine.js` imports nothing at all, which is what makes it safe here.
    // (Same reasoning as `search/generate.js` importing `@uniweb/core/locale-config`
    // rather than the package root, and for the same kind of reason.)
    //
    // Dynamic, as Fuse's import was: a site on another provider never loads it.
    const engine = await import('@uniweb/projections/search/engine')
    const built = { engine, entries, structure: engine.buildSearchStructure(entries) }
    structureCache.set(cacheKey, built)

    return built
  }

  return {
    async query(text, { limit = 10, type, route } = {}) {
      const { engine, entries, structure } = await getEngine()

      // ⛔ RANK FIRST, FILTER SECOND, AND DO NOT PASS `limit` DOWN. `type` and
      // `route` are applied here, so a limit applied inside the engine would cut
      // the ranking before this filter sees it, and a filtered search would come
      // back short of results that exist.
      const ranked = engine.rankSearchEntries(structure, text, entries)
      let results = ranked.hits.map((h) => ({ item: entries[h.doc] }))

      if (type) {
        results = results.filter(({ item }) => item.type === type)
      }
      if (route) {
        results = results.filter(({ item }) => item.route?.startsWith(route))
      }

      // ⭐ NO LITERAL TIER. There was one, sorting pages that contain the words
      // above the scorer's near-misses, because Fuse rated an approximate match
      // as highly as an exact one — a page containing the term could sit below
      // ten that never mention it. The engine's IDF, and its rule that the fuzzy
      // fallback runs only on a total miss, make that unrepresentable rather than
      // corrected — so the tier is deleted rather than ported.

      // Exact here, unlike the endpoint provider: the whole corpus is local, so
      // this counts every match after filtering and before the cut — the number
      // a "showing 10 of 47" needs, and 47 is knowable only on this side of the
      // slice.
      const total = results.length

      const tokens = engine.tokenize(text)
      const page = results.slice(0, limit).map(({ item }) => {
        const matches = matchIndices(item, tokens)
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
      await getEngine()
    },

    clearCache() {
      clearSearchCache(website.getSearchIndexUrl())
    }
  }
}
