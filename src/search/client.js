/**
 * Search Client
 *
 * Manages search index loading, caching, and querying using Fuse.js.
 */

import { buildSnippet } from './snippets.js'

// Storage versioning for cache invalidation
const STORAGE_VERSION = 'v1'
const STORAGE_PREFIX = `uniweb:search:${STORAGE_VERSION}:`

// In-memory caches
const indexCache = new Map()
const fuseCache = new Map()

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
  ignoreLocation: true,
  minMatchCharLength: 2
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

  const raw = storage.getItem(`${STORAGE_PREFIX}${cacheKey}`)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.entries)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Save index to localStorage
 * @param {string} cacheKey - Cache key
 * @param {Object} payload - Index data
 */
function saveToStorage(cacheKey, payload) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(`${STORAGE_PREFIX}${cacheKey}`, JSON.stringify(payload))
  } catch {
    // Ignore quota errors
  }
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

  // Check memory cache first
  if (indexCache.has(cacheKey)) {
    return indexCache.get(cacheKey)
  }

  // Check localStorage cache
  if (useStorage) {
    const cached = loadFromStorage(cacheKey)
    if (cached) {
      indexCache.set(cacheKey, cached)
      return cached
    }
  }

  // Fetch from server
  const response = await fetch(indexUrl, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`Failed to load search index: ${response.status}`)
  }

  const payload = await response.json()

  // Cache the result
  indexCache.set(cacheKey, payload)
  if (useStorage) {
    saveToStorage(cacheKey, payload)
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
      storage.removeItem(`${STORAGE_PREFIX}${cacheKey}`)
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
 * Create a search client for a Website instance
 *
 * @param {Object} website - Website instance from @uniweb/core
 * @param {Object} options - Configuration options
 * @param {Object} [options.fuseOptions] - Custom Fuse.js options
 * @param {boolean} [options.useStorage=true] - Use localStorage caching
 * @param {number} [options.defaultLimit=10] - Default result limit
 * @returns {Object} Search client with query method
 *
 * @example
 * const search = createSearchClient(website)
 * const results = await search.query('authentication')
 */
export function createSearchClient(website, options = {}) {
  const {
    fuseOptions = {},
    useStorage = true,
    defaultLimit = 10
  } = options

  const mergedFuseOptions = { ...DEFAULT_FUSE_OPTIONS, ...fuseOptions }

  /**
   * Get or create Fuse instance for the current locale
   * @returns {Promise<Fuse>}
   */
  async function getFuse() {
    const indexUrl = website.getSearchIndexUrl()
    const cacheKey = indexUrl

    // Check Fuse cache
    if (fuseCache.has(cacheKey)) {
      return fuseCache.get(cacheKey)
    }

    // Load index and create Fuse instance
    const index = await loadSearchIndex(indexUrl, { cacheKey, useStorage })

    // Dynamically import Fuse.js (peer dependency)
    let Fuse
    try {
      const fuseMod = await import('fuse.js')
      Fuse = fuseMod.default || fuseMod
    } catch (err) {
      throw new Error(
        'Fuse.js is required for search functionality. ' +
        'Install it with: npm install fuse.js'
      )
    }

    const fuse = new Fuse(index.entries || [], mergedFuseOptions)
    fuseCache.set(cacheKey, fuse)

    return fuse
  }

  return {
    /**
     * Check if search is enabled
     * @returns {boolean}
     */
    isEnabled() {
      return website.isSearchEnabled()
    },

    /**
     * Get the search index URL
     * @returns {string}
     */
    getIndexUrl() {
      return website.getSearchIndexUrl()
    },

    /**
     * Get search configuration
     * @returns {Object}
     */
    getConfig() {
      return website.getSearchConfig()
    },

    /**
     * Perform a search query
     *
     * @param {string} query - Search query
     * @param {Object} queryOptions - Query options
     * @param {number} [queryOptions.limit] - Maximum results
     * @param {string} [queryOptions.type] - Filter by type ('page' or 'section')
     * @param {string} [queryOptions.route] - Filter by route prefix
     * @returns {Promise<Array>} Search results
     */
    async query(query, queryOptions = {}) {
      const { limit = defaultLimit, type, route } = queryOptions

      const trimmed = query?.trim()
      if (!trimmed) return []

      if (!website.isSearchEnabled()) {
        console.warn('Search is not enabled for this site')
        return []
      }

      const fuse = await getFuse()
      let results = fuse.search(trimmed)

      // Apply type filter
      if (type) {
        results = results.filter(({ item }) => item.type === type)
      }

      // Apply route filter
      if (route) {
        results = results.filter(({ item }) => item.route?.startsWith(route))
      }

      // Apply limit
      const limited = results.slice(0, limit)

      // Transform results
      return limited.map(({ item, matches }) => {
        const snippet = buildSnippet(item.content, matches, { key: 'content' })

        return {
          // Identity
          id: item.id,
          type: item.type,

          // Navigation
          route: item.route,
          sectionId: item.sectionId,
          anchor: item.anchor,
          href: item.anchor ? `${item.route}#${item.anchor}` : item.route,

          // Display
          title: item.title,
          pageTitle: item.pageTitle,
          description: item.description,
          excerpt: item.excerpt,
          component: item.component,

          // Search result specific
          snippetText: snippet.text,
          snippetHtml: snippet.html,
          matches
        }
      })
    },

    /**
     * Preload the search index (call this to warm the cache)
     * @returns {Promise<void>}
     */
    async preload() {
      if (!website.isSearchEnabled()) return
      await getFuse()
    },

    /**
     * Clear the search cache
     */
    clearCache() {
      const indexUrl = website.getSearchIndexUrl()
      clearSearchCache(indexUrl)
    }
  }
}

export default createSearchClient
